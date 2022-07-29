
import * as ts from "typescript"
import { writeFileSync } from "fs"
import * as path from "node:path"
import { cloneNode } from "ts-clone-node"

import * as cgm from "./manager.js"
import * as inst from "./llvm/instructions"
import * as wg from "./ts/wrapper_gen"
import * as cg_utils from "./code_gen_utils"
import { createModuleLoaderSourceFile, createWrapTwinObjectDeclaration } from "./ts/ts_templates";
import { emitObjectFieldGetter, emitObjectFieldSetter, emitObjectAllocationFunctionDefinition } from "./llvm/llvm_templates"
import { emitFunctionDefinition, emitStaticAllocation } from "./llvm/emit"
import { processExpression, processBooleanBinaryExpression, expressionContextToValueReg } from "./expressions"

class StatementSynthesizedContext {
	static readonly emptyContext = new StatementSynthesizedContext([]);

	constructor(readonly nextList: inst.BackpatchEntry[]) {};

	patchNextList(label: number): void {
		this.nextList.forEach(entry => entry.patch(label));
	}

	isEmpty(): boolean {
		return (this.nextList.length == 0);
	}
}

export function processProgram(): void {

	const sourceFiles = cgm.getSourceFiles();

	sourceFiles.forEach(file => {
		const wrapperSourceFile = processSourceFile(file);
		const wrapperPath = path.join(cgm.outputDirPath, path.basename(file.fileName));
		writeFileSync(wrapperPath, cgm.printer.printFile(wrapperSourceFile));
	})
	const outCode = cgm.iBuff.dumpBuffer();
	writeFileSync(cgm.irOutputPath, outCode);

	const loadModuleSourceFile = createModuleLoaderSourceFile();
	//TODO: replace explicit file name here
	writeFileSync(`${cgm.outputDirPath}/wasm_loader.ts`, cgm.printer.printFile(loadModuleSourceFile));
}

function processSourceFile(file: ts.SourceFile): ts.SourceFile {
	let wrapperFileStatements: ts.Statement[] = [ wg.createModuleLoaderImportStatement() ];

	file.statements.forEach(st => {
		let wrapperStatement: ts.Statement;
		switch (st.kind) {
			case ts.SyntaxKind.ClassDeclaration:
				wrapperStatement = processClassDecleration(st as ts.ClassDeclaration);
				break;
			case ts.SyntaxKind.FunctionDeclaration:
				//TODO: create wrapper function if declaration is exported
				wrapperStatement = processFunctionDeclaration(st as ts.FunctionDeclaration);
				break;
			default:
				wrapperStatement = cloneNode(st);
				break;
		}
		wrapperFileStatements.push(wrapperStatement);
	});
	return wg.createWrapperSourceFile(wrapperFileStatements);
}

function processClassDecleration(classDeclaration: ts.ClassDeclaration): ts.Statement {
	/*
	 assumptions:
	 * classes must be named
	 * class members contain only properties (fields), non-static methods and a single constructor
	 */
	let symbol: ts.Symbol = cgm.checker.getSymbolAtLocation(classDeclaration.name!)!;
	let type: ts.Type = cgm.checker.getDeclaredTypeOfSymbol(symbol);
	let properties: ts.Symbol[] = cgm.checker.getPropertiesOfType(type).filter(sym => sym.flags == ts.SymbolFlags.Property);
	let propTypes: ts.Type[] = properties.map(symbol => cgm.checker.getTypeOfSymbolAtLocation(symbol, classDeclaration));
	let propTypeFlags: ts.TypeFlags[] = properties.map(sym => cgm.checker.getTypeOfSymbolAtLocation(sym, classDeclaration).flags);
	for (let i: number = 0; i < properties.length; i++) {
		emitObjectFieldGetter(type, properties[i], propTypes[i], i);
		emitObjectFieldSetter(type, properties[i], propTypes[i], i);
	}
	cgm.iBuff.emitStructDefinition(new inst.StructDefinitionInstruction(symbol.name, propTypes));
	emitObjectAllocationFunctionDefinition(type);
	let wrapperClassMembers: ts.ClassElement[] = []
	classDeclaration.forEachChild(child => {
		switch (child.kind) {
			case ts.SyntaxKind.PropertyDeclaration:
				wrapperClassMembers.push(wg.createWrapperGetter(child as ts.PropertyDeclaration));
				wrapperClassMembers.push(wg.createWrapperSetter(child as ts.PropertyDeclaration));
				break;
			case ts.SyntaxKind.Constructor:
				let wrapperConstructorDeclaration = processConstructorDeclaration(child as ts.ConstructorDeclaration, type);
				wrapperClassMembers.push(wrapperConstructorDeclaration);
				break;
			case ts.SyntaxKind.MethodDeclaration:
				let wrapperMethodDeclaration = processMethodDeclaration(child as ts.MethodDeclaration, type);
				wrapperClassMembers.push(wrapperMethodDeclaration);
				break;
		}
	});
	wrapperClassMembers.push(createWrapTwinObjectDeclaration(type));
	return wg.createWrapperClassDecleration(classDeclaration.name!.getText(), wrapperClassMembers);
}

//TODO: replace classType with general inherited context
//TODO: wrap emittig function and move to emitter file
function processConstructorDeclaration(constructorDecleration: ts.ConstructorDeclaration, classType: ts.Type): ts.ConstructorDeclaration {
	/**
	 * assumptions:
	 * - constructor has a single declaration
	 */
	emitFunctionDefinition(constructorDecleration, classType);
	let ctorRetReg: number = 0;
	ctorRetReg = cgm.iBuff.getNewReg();
	cgm.iBuff.emit(new inst.ObjectAllocationInstruction(ctorRetReg, classType));
	cgm.symbolTable.set('this', ctorRetReg);
	constructorDecleration.body!.statements.forEach(processStatement);
	cgm.iBuff.emit(new inst.ReturnInstruction(classType, ctorRetReg));
	cgm.iBuff.emit(new inst.FunctionEndInstruction());

	return wg.createWrapperConstructorDeclaration(constructorDecleration);
}

//TODO: replace classType with general inherited context
function processMethodDeclaration(methodDeclaration: ts.MethodDeclaration, classType: ts.Type): ts.MethodDeclaration {
	emitFunctionDefinition(methodDeclaration, classType);
	methodDeclaration.body!.statements.forEach(processStatement);
	let retType: ts.Type = cgm.checker.getSignatureFromDeclaration(methodDeclaration)!.getReturnType();
	if (retType.getFlags() & ts.TypeFlags.Void) {
		cgm.iBuff.emit(new inst.ReturnInstruction(null));
	}
	cgm.iBuff.emit(new inst.FunctionEndInstruction());

	return wg.createWrapperMethodDeclaration(methodDeclaration);

}

function processFunctionDeclaration(functionDecleration: ts.FunctionDeclaration): ts.Statement {
	const signature = cgm.checker.getSignatureFromDeclaration(functionDecleration)!;
	let paramTypes: ts.Type[] = [];
	cgm.symbolTable.clear();
	for (let i = 0; i < signature.parameters.length; i++) {
		const paramSymbol = signature.parameters[i];
		cgm.symbolTable.set(paramSymbol.getName(), -(i + 1)); //TODO: find an elegant representations of function arguments
		paramTypes.push(cg_utils.getSymbolTypeFlags(paramSymbol));
	}

	let retType = cgm.checker.getReturnTypeOfSignature(signature);
	let id = functionDecleration.name!.getText();

	cgm.iBuff.emit(new inst.FunctionDefinitionInstruction(id, retType, paramTypes));

	const bodyContext = processBlock(functionDecleration.body!);

	//TODO: make this if more readable
	if ( cgm.checker.getReturnTypeOfSignature(cgm.checker.getSignatureFromDeclaration(functionDecleration)!).flags & ts.TypeFlags.Void) {
		const label = cgm.iBuff.emitNewLabel();
		bodyContext.patchNextList(label);
		cgm.iBuff.emit(new inst.ReturnInstruction(null));
	}

	cgm.iBuff.emit(new inst.FunctionEndInstruction());
	return wg.createWrapperFunctionDeclaration(functionDecleration);
}

function processStatement(st: ts.Statement): StatementSynthesizedContext {
	let statementContext = StatementSynthesizedContext.emptyContext;
	switch (st.kind) {
		case ts.SyntaxKind.ExpressionStatement:
			processExpression((st as ts.ExpressionStatement).expression);
			break;
		case ts.SyntaxKind.VariableStatement:
			processVariableDeclerationsList((st as ts.VariableStatement).declarationList);
			break;
		case ts.SyntaxKind.ReturnStatement:
			processReturnStatement(st as ts.ReturnStatement);
			break;
		case ts.SyntaxKind.Block:
			statementContext = processBlock(st as ts.Block);
			break;
		case ts.SyntaxKind.IfStatement:
			statementContext = processIfStatement(st as ts.IfStatement);
			break;
		case ts.SyntaxKind.ForStatement:
			statementContext = processForStatement(st as ts.ForStatement);
			break;
		default:
			throw new Error(`unsupported statement kind: ${ts.SyntaxKind[st.kind]}`);
			break;
	}
	return statementContext;
}

function processVariableDeclerationsList(list: ts.VariableDeclarationList): void {
	//(node as ts.VariableStatement).declarationList.declarations.forEach(processNode);
	list.declarations.forEach(variableDecleration => {
		if (variableDecleration.initializer) {
			//TODO: handle boolean values
			const type = cgm.checker.getTypeAtLocation(variableDecleration);
			const variableAdressReg = emitStaticAllocation(type);
			let variableName: string = variableDecleration.name.getText();
			cgm.symbolTable.set(variableName, variableAdressReg);
			let initializerContext = processExpression(variableDecleration.initializer);
			const initializerValueReg = expressionContextToValueReg(initializerContext, type);
			cgm.iBuff.emit(new inst.StoreInstruction(variableAdressReg, initializerValueReg, type));
		}
	});
}

function processReturnStatement(returnStatement: ts.ReturnStatement): void {
	let retInst: inst.ReturnInstruction;
	if (returnStatement.expression) {
		//TODO: handle boolean values
		let retType = cgm.checker.getTypeAtLocation(returnStatement.expression);
		let expressionContext = processExpression(returnStatement.expression);
		const retValueReg = expressionContextToValueReg(expressionContext, retType);
		retInst = new inst.ReturnInstruction(retType, retValueReg);
	}
	else {
		retInst = new inst.ReturnInstruction(null);
	}
	cgm.iBuff.emit(retInst);
}

function processBlock(block: ts.Block): StatementSynthesizedContext {

	let statementContext = StatementSynthesizedContext.emptyContext;
	block.statements.forEach(statement => {
		if (!statementContext.isEmpty()) {
			const label = cgm.iBuff.emitNewLabel();
			statementContext.patchNextList(label);
		}
		statementContext = processStatement(statement);
	});
	return statementContext;
}

function processIfStatement(ifStatement: ts.IfStatement): StatementSynthesizedContext {
	//throw new Error('if statements are currently broken');
	/**
	 * assumptions:
	 * - the expression checked is a binary expression with boolean type
	 */
	//TODO: handle cases where the expression is an identifier/constant value (saved value in general)
	const expressionContext = processBooleanBinaryExpression(ifStatement.expression as ts.BinaryExpression);
	const trueLabel = cgm.iBuff.emitNewLabel();
	expressionContext.patchTrueList(trueLabel);
	const thenContext = processStatement(ifStatement.thenStatement);

	if (ifStatement.elseStatement){
		const falseLabel = cgm.iBuff.emitNewLabel();
		expressionContext.patchFalseList(falseLabel);
		const elseContext = processStatement(ifStatement.elseStatement);
		return new StatementSynthesizedContext([ ...thenContext.nextList, ...elseContext.nextList ]);
	}
	else { //no else statement
		return new StatementSynthesizedContext([ ...thenContext.nextList, ...expressionContext.falseList ]);
	}
}

function processForStatement(forStatement: ts.ForStatement): StatementSynthesizedContext {
	let initializerEndBranch: inst.BranchInstruction | undefined;
	if (forStatement.initializer) {
		//TODO: replace with processForInitializer and handle expression initializer
		processVariableDeclerationsList(forStatement.initializer as ts.VariableDeclarationList);
		initializerEndBranch = new inst.BranchInstruction();
		cgm.iBuff.emit(initializerEndBranch);
	}

	const conditionLabel = cgm.iBuff.emitNewLabel();
	if (initializerEndBranch) {
		initializerEndBranch.patch(conditionLabel);
	}
	/**
	 * assumption:
	 * - there is always a condition expression.
	 * - the condition is a boolean binary expression.
	 */
	const conditionContext = processBooleanBinaryExpression(forStatement.condition as ts.BinaryExpression);

	const bodyLabel = cgm.iBuff.emitNewLabel();
	conditionContext.patchTrueList(bodyLabel);
	const bodyContext = processStatement(forStatement.statement);
	const bodyEndBranch = new inst.BranchInstruction();
	cgm.iBuff.emit(bodyEndBranch);

	// * assumption - there is an incrementor
	/**
	 * assumption:
	 * - there is an incrementor.
	 * - the incrementor is not a boolean expression.
	 */
	const incrementorLabel = cgm.iBuff.emitNewLabel();
	bodyEndBranch.patch(incrementorLabel);
	bodyContext.patchNextList(incrementorLabel);
	processExpression(forStatement.incrementor!);
	cgm.iBuff.emit(new inst.BranchInstruction(conditionLabel));

	return new StatementSynthesizedContext(conditionContext.falseList);
}

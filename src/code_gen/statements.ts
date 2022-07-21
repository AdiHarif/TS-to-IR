
import * as ts from "typescript"
import { writeFileSync } from "fs"
import { cloneNode } from "ts-clone-node"

import * as cgm from "./manager.js"
import * as inst from "./llvm/instructions"
import * as wg from "./ts/wrapper_gen"
import * as cg_utils from "./code_gen_utils"
import { createLoadModuleStatements, createWrapTwinObjectDeclaration } from "./ts/ts_templates";
import { emitObjectFieldGetter, emitObjectFieldSetter, emitObjectAllocationFunctionDefinition } from "./llvm/llvm_templates"
import { emitFunctionDefinition } from "./llvm/emit"
import { processExpression } from "./expressions"


export function processProgram(): void {

	const sourceFile = cgm.getSourceFile();

	const wrapperSourceFile = processSourceFile(sourceFile);

	const outCode = cgm.iBuff.dumpBuffer();
	writeFileSync(cgm.irOutputPath, outCode);

	writeFileSync(cgm.wrapperOutputPath, cgm.printer.printFile(wrapperSourceFile));
}

function processSourceFile(file: ts.SourceFile): ts.SourceFile {
	let wrapperFileStatements: ts.Statement[] = [];

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
	wrapperFileStatements.push(...createLoadModuleStatements(cgm.getWasmFileName(), cgm.importedFunctionsNodes));
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
	cgm.iBuff.emitStructDefinition(new inst.StructDefinitionInstruction(symbol.name, propTypeFlags));
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
	cgm.regMap.set('this', ctorRetReg);
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
	cgm.regMap.clear();
	for (let i = 0; i < signature.parameters.length; i++) {
		const paramSymbol = signature.parameters[i];
		cgm.regMap.set(paramSymbol.getName(), -(i + 1)); //TODO: find an elegant representations of function arguments
		paramTypes.push(cg_utils.getSymbolTypeFlags(paramSymbol));
	}

	let retType = cgm.checker.getReturnTypeOfSignature(signature);
	let id = functionDecleration.name!.getText();

	cgm.iBuff.emit(new inst.FunctionDefinitionInstruction(id, retType, paramTypes));

	functionDecleration.body!.statements.forEach(processStatement);

	//TODO: make this if more readable
	if ( cgm.checker.getReturnTypeOfSignature(cgm.checker.getSignatureFromDeclaration(functionDecleration)!).flags & ts.TypeFlags.Void) {
		cgm.iBuff.emit(new inst.ReturnInstruction(null));
	}

	cgm.iBuff.emit(new inst.FunctionEndInstruction());
	return wg.createWrapperFunctionDeclaration(functionDecleration);
}

function processStatement(st: ts.Statement): void {
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
			(st as ts.Block).statements.forEach(processStatement);
			break;
		case ts.SyntaxKind.IfStatement:
			processIfStatement(st as ts.IfStatement);
			break;
		default:
			throw new Error(`unsupported statement kind: ${ts.SyntaxKind[st.kind]}`);
			break;
	}
}

function processVariableDeclerationsList(list: ts.VariableDeclarationList): void {
	//(node as ts.VariableStatement).declarationList.declarations.forEach(processNode);
	list.declarations.forEach(variableDecleration => {
		if (variableDecleration.initializer) {
			//TODO: handle boolean values
			let resultReg: number = processExpression(variableDecleration.initializer);
			let variableName: string = variableDecleration.name.getText();
			cgm.regMap.set(variableName, resultReg);
		}
	});
}

function processReturnStatement(returnStatement: ts.ReturnStatement): void {
	let retInst: inst.ReturnInstruction;
	if (returnStatement.expression) {
		//TODO: handle boolean values
		let resultReg: number = processExpression(returnStatement.expression);
		let retType = cgm.checker.getTypeAtLocation(returnStatement.expression);
		retInst = new inst.ReturnInstruction(retType, resultReg);
	}
	else {
		retInst = new inst.ReturnInstruction(null);
	}
	cgm.iBuff.emit(retInst);
}

function processIfStatement(st: ts.IfStatement): void {
	throw new Error('if statements are currently broken');
	//TODO: this is an old implementation, should be reviewed
	// const ifStat = node as ts.IfStatement;
	// const expCgCtx = processNode(ifStat.expression) as UnsavedExpressionCodeGenContext; //TODO: handle cases where the expression is an identifier/constant value (saved value in general)
	// const trueLabel = cgm.iBuff.emitNewLabel();

	// cgm.iBuff.backPatch((expCgCtx as UnsavedExpressionCodeGenContext).trueList, trueLabel);
	// const thenBpCtx = processNode(ifStat.thenStatement) as StatementCodeGenContext;

	// if (ifStat.elseStatement){
	// 	const falseLabel = cgm.iBuff.emitNewLabel();
	// 	cgm.iBuff.backPatch(expCgCtx.falseList, falseLabel);
	// 	const elseBpCtx = processNode(ifStat.elseStatement) as StatementCodeGenContext;
	// 	return new StatementCodeGenContext(elseBpCtx.nextList.concat(thenBpCtx.nextList));
	// }
	// else { //no else statement
	// 	return new StatementCodeGenContext(expCgCtx.falseList.concat(thenBpCtx.nextList));
	// }
}

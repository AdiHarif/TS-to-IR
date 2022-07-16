
import * as ts from "typescript";
import { writeFileSync } from "fs";
import { assert } from "console";

import * as cgm from "./manager.js"
import * as inst from "./llvm/instructions";
import { emitObjectAllocationFunctionDefinition, emitObjectFieldGetter, emitObjectFieldSetter } from "./llvm/llvm_templates.js"
import { createLoadModuleStatements, createWrapTwinObjectDeclaration } from "./ts/ts_templates";
import * as wg from "./ts/wrapper_gen"

class StatementCodeGenContext {
	public nextList: inst.BpEntry[] = [];

	constructor(nextList: inst.BpEntry[]) {
		this.nextList = nextList;
	}

	isEmpty(): boolean {
		return this.nextList.length == 0;
	}
}

interface ExpressionCodeGenContext  {
	isValueSaved: boolean;
}

class SavedExpressionCodeGenContext implements ExpressionCodeGenContext {
	readonly isValueSaved: boolean = true;

	public reg: number;

	constructor(reg: number) {
		this.reg = reg;
	}
}

class UnsavedExpressionCodeGenContext implements ExpressionCodeGenContext {
	readonly isValueSaved: boolean = false;
	readonly typeFlags: ts.TypeFlags = ts.TypeFlags.Boolean;

	public trueList: inst.BpEntry[] = [];
	public falseList: inst.BpEntry[] = [];

	constructor(trueList: inst.BpEntry[], falseList: inst.BpEntry[]) {
		this.trueList = trueList;
		this.falseList = falseList;
	}

}

type CodeGenContext = StatementCodeGenContext | ExpressionCodeGenContext;

const libFunctions = [ //TODO: add printf and remove handling console.log
	"scanf"
];

//TODO: find a more suitable place for this list.
let importedFunctions: string[] = [];

//TODO: merge with importedFunctions (maybe wrap with an imports class?) and make more general
let importedFunctionsNodes: ts.PropertyAccessExpression[] = []

export function processProgram(): void {

	const sourceFile = cgm.getSourceFile();

	const wrapperSourceFile = processSourceFile(sourceFile);

	const outCode = cgm.iBuff.dumpBuffer();
	writeFileSync(cgm.irOutputPath, outCode);

	writeFileSync(cgm.wrapperOutputPath, cgm.printer.printFile(wrapperSourceFile));
}

function getSymbolTypeFlags(symbol: ts.Symbol): ts.Type {
	return cgm.checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!);
}

//TODO: discard this function or split it to smaller tasks
function emitFunctionDefinition(fun: ts.FunctionLikeDeclaration, cls?: ts.Type): void {
	const signature = cgm.checker.getSignatureFromDeclaration(fun)!;
	let paramTypes: ts.Type[] = [];
	cgm.regMap.clear();
	for (let i = 0; i < signature.parameters.length; i++) {
		const paramSymbol = signature.parameters[i];
		cgm.regMap.set(paramSymbol.getName(), -(i + 1)); //TODO: find an elegant representations of function arguments
		paramTypes.push(getSymbolTypeFlags(paramSymbol));
	}
	let id: string;
	let retType: ts.Type | null;
	if (fun.kind == ts.SyntaxKind.Constructor) {
		retType = cls!;
		id = 'constructor';
	}
	else {
		retType = cgm.checker.getReturnTypeOfSignature(signature);
		id = fun.name!.getText();
	}

	if (cls) {
		id = cls.symbol.getName() + '_' + id;
		if (fun.kind != ts.SyntaxKind.Constructor) {
			paramTypes.push(cls);
		}
		cgm.regMap.set('this', -(signature.parameters.length + 1));
	}
	cgm.iBuff.emit(new inst.FunctionDefinitionInstruction(id, retType, paramTypes));
}

function emitNumericBinaryExpression(exp: ts.BinaryExpression): SavedExpressionCodeGenContext {
	const leftReg = processExpression(exp.left);
	const rightReg = processExpression(exp.right);
	const resReg = cgm.iBuff.getNewReg();
	cgm.iBuff.emit(new inst.NumericOpInstruction(resReg, leftReg, rightReg, exp.operatorToken.kind));
	return new SavedExpressionCodeGenContext(resReg);
}

//TODO: re-implement this function when taking care of boolean expressions
// function emitBooleanBinaryExpression(exp: ts.BinaryExpression): UnsavedExpressionCodeGenContext {
// 	const leftCtx = processNode(exp.left) as SavedExpressionCodeGenContext;
// 	const rightCtx = processNode(exp.right) as SavedExpressionCodeGenContext;
// 	switch (exp.operatorToken.kind) {
// 		case ts.SyntaxKind.LessThanToken:
// 		case ts.SyntaxKind.LessThanEqualsToken:
// 		case ts.SyntaxKind.GreaterThanToken:
// 		case ts.SyntaxKind.GreaterThanEqualsToken:
// 		case ts.SyntaxKind.EqualsEqualsToken:
// 		case ts.SyntaxKind.ExclamationEqualsToken:
// 			let resReg = cgm.iBuff.getNewReg();
// 			cgm.iBuff.emit(new inst.EqualityOpInstruction(resReg, leftCtx.reg, rightCtx.reg, exp.operatorToken.kind));
// 			let brInst = cgm.iBuff.emit(new inst.ConditionalBranchInstruction(resReg));
// 			let trueEntry: inst.BpEntry = { instruction: brInst, index: 0 };
// 			let falseEntry: inst.BpEntry = { instruction: brInst, index: 1 };
// 			return new UnsavedExpressionCodeGenContext([trueEntry], [falseEntry]);
// 			break;
// 		default:
// 			throw new Error("unsupported binary op: " + ts.SyntaxKind[exp.operatorToken.kind]);
// 	}

// }

function emitFunctionCall(retType: ts.Type | null, name: string, paramRegs: inst.TypedReg[]): SavedExpressionCodeGenContext {
	//TODO: remove allocating new reg for void functions
	const retReg: inst.TypedReg = {
		reg: cgm.iBuff.getNewReg(),
		type: retType
	};
	cgm.iBuff.emit(new inst.FunctionCallInstruction(retReg, name, paramRegs));
	return new SavedExpressionCodeGenContext(retReg.reg);
}

function emitLibFuncitonCall(funCall: ts.CallExpression): SavedExpressionCodeGenContext {
	const funName = (funCall.expression as ts.Identifier).getText();
	const args = funCall.arguments;
	let llvmFunName = "";
	let llvmRetType = null;
	let llvmArgs: inst.TypedReg[] = [];
	switch (funName){
		case "scanf":
			assert(args.length == 1);
			const format = args[0].getText();
			switch (format) {
				case '\"%f\"':
				case '\"%lf\"':
				case '\"%d\"':
					llvmFunName = "scand";
					llvmRetType = null; //TODO: restore this to be number type
					break;
				default:
					throw new Error("unsupported scanf format: " + format);
			}
			break;
		default:
			throw new Error("")
	}

	//TODO: remove allocating new reg for void functions
	const llvmRetReg: inst.TypedReg = {
		reg: cgm.iBuff.getNewReg(),
		type: llvmRetType
	};
	cgm.iBuff.emit(new inst.FunctionCallInstruction(llvmRetReg, llvmFunName, llvmArgs));
	return new SavedExpressionCodeGenContext(llvmRetReg.reg);
}

function emitNewExpression(newExp: ts.NewExpression): SavedExpressionCodeGenContext {
	let objType: ts.Type = cgm.checker.getDeclaredTypeOfSymbol(cgm.checker.getSymbolAtLocation(newExp.expression as ts.Identifier)!);
	let paramRegs: inst.TypedReg[] = [];
	//TODO: wrap this part with 'emitArguments' or something similar and merge with compileNode CallExpression case
	newExp.arguments?.forEach(exp => {
		const expReg = processExpression(exp); //TODO: handle unsaved expressions
		let argType = cgm.checker.getTypeAtLocation(exp);
		if (argType.getFlags() == ts.TypeFlags.Any) {
			argType = cgm.checker.getContextualType(exp)!;
		}
		paramRegs.push({
			reg: expReg, type: argType
		});
	});
	let funcName: string = objType.getSymbol()!.getName() + '_constructor'
	return emitFunctionCall(objType, funcName, paramRegs);
}

function emitAssignment(exp: ts.BinaryExpression): number {
	let rightReg = processExpression(exp.right);
	if (exp.left.kind == ts.SyntaxKind.Identifier) {
		cgm.regMap.set((exp.left as ts.Identifier).getText(), rightReg);
	}
	else {
		assert(exp.left.kind == ts.SyntaxKind.PropertyAccessExpression);
		//TODO: add assertion of the property access being a property and not function
		let leftCgCtx: SavedExpressionCodeGenContext = emitGetPropertyAddress(exp.left as ts.PropertyAccessExpression);
		cgm.iBuff.emit(new inst.StoreInstruction(leftCgCtx.reg, rightReg, cgm.checker.getTypeAtLocation(exp.right)));
	}
	return rightReg;
}

function emitGetPropertyAddress(exp: ts.PropertyAccessExpression): SavedExpressionCodeGenContext {
	let ptrReg: number = cgm.iBuff.getNewReg();
	let objReg: number;
	let objType: ts.Type = cgm.checker.getTypeAtLocation(exp.expression);
	let objPropNames = cgm.checker.getPropertiesOfType(objType).filter(sym => sym.flags == ts.SymbolFlags.Property).map(sym => sym.getName());
	let propIndex: number = objPropNames.indexOf(exp.name.getText());
	if (exp.expression.kind == ts.SyntaxKind.ThisKeyword) {
		objReg = cgm.regMap.get('this')!;
	}
	else {
		objReg = cgm.regMap.get((exp.expression as ts.Identifier).getText())!;
	}
	cgm.iBuff.emit(new inst.GetElementInstruction(ptrReg, objReg, objType, propIndex))
	return new SavedExpressionCodeGenContext(ptrReg);
}

function emitLoadProperty(exp: ts.PropertyAccessExpression): SavedExpressionCodeGenContext {
	let addressCgCtx = emitGetPropertyAddress(exp);
	let resReg = cgm.iBuff.getNewReg();
	let valType: ts.Type = cgm.checker.getTypeAtLocation(exp);
	cgm.iBuff.emit(new inst.LoadInstruction(addressCgCtx.reg, resReg, valType))
	return new SavedExpressionCodeGenContext(resReg);
}

function processSourceFile(file: ts.SourceFile): ts.SourceFile {
	let wrapperFileStatements: ts.Statement[] = [];

	file.statements.forEach(st => {
		let wrapperStatement: ts.Statement;
		switch (st.kind) {
			case ts.SyntaxKind.ClassDeclaration:
				wrapperStatement = processClassDecleration(st as ts.ClassDeclaration);
				wrapperFileStatements.push(wrapperStatement);
				break;
			case ts.SyntaxKind.FunctionDeclaration:
				//TODO: create wrapper function if declaration is exported
				processFunctionDeclaration(st as ts.FunctionDeclaration);
				break;
			default:
				//TODO: add copying top level statements to wrapper
				throw new Error("top level statements arent supported");
				break;
		}
	});
	wrapperFileStatements.push(...createLoadModuleStatements(cgm.getWasmFileName(), importedFunctionsNodes));
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

function processFunctionDeclaration(functionDecleration: ts.FunctionDeclaration): void {
	const signature = cgm.checker.getSignatureFromDeclaration(functionDecleration)!;
	let paramTypes: ts.Type[] = [];
	cgm.regMap.clear();
	for (let i = 0; i < signature.parameters.length; i++) {
		const paramSymbol = signature.parameters[i];
		cgm.regMap.set(paramSymbol.getName(), -(i + 1)); //TODO: find an elegant representations of function arguments
		paramTypes.push(getSymbolTypeFlags(paramSymbol));
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

function processExpression(exp: ts.Expression): number {
	switch (exp.kind) {
		case ts.SyntaxKind.Identifier:
			return cgm.regMap.get((exp as ts.Identifier).getText())!;
			break;
		case ts.SyntaxKind.NumericLiteral:
			return processNumericLiteral(exp as ts.NumericLiteral);
			break;
		case ts.SyntaxKind.ParenthesizedExpression:
			return processExpression((exp as ts.ParenthesizedExpression).expression);
			break;
		case ts.SyntaxKind.BinaryExpression:
			return processBinaryExpression(exp as ts.BinaryExpression);
			break;
		case ts.SyntaxKind.NewExpression:
			return emitNewExpression(exp as ts.NewExpression).reg;
			break;
		case ts.SyntaxKind.PropertyAccessExpression:
			return emitLoadProperty(exp as ts.PropertyAccessExpression).reg;
			break;
		case ts.SyntaxKind.CallExpression:
			return processCallExpression(exp as ts.CallExpression);
			break;
		default:
			throw new Error(`unsupported expression kind: ${ts.SyntaxKind[exp.kind]}`);
			break;
	}
}

function processNumericLiteral(numericLiteral: ts.NumericLiteral): number {
	// ? TODO: return the constant value as context instead of saving it to register
	const val = parseInt((numericLiteral as ts.NumericLiteral).getText()); //TODO: support bases other than decimal
	const reg = cgm.iBuff.getNewReg();
	cgm.iBuff.emit(new inst.NumericAssignmentInstruction(reg, val));
	return reg;
}

function processBinaryExpression(binaryExpression: ts.BinaryExpression): number {
	const typeFlags = cgm.checker.getTypeAtLocation(binaryExpression).flags;
	if ((binaryExpression as ts.BinaryExpression).operatorToken.kind == ts.SyntaxKind.EqualsToken) {
		return emitAssignment(binaryExpression as ts.BinaryExpression);
	}
	else if (typeFlags & ts.TypeFlags.Number) {
		return emitNumericBinaryExpression(binaryExpression as ts.BinaryExpression).reg;
	}
	else {
		throw new Error('unsupported expression type');
	}
}

//TODO: refactor this function ASAP
function processCallExpression(callExpression: ts.CallExpression): number {
	let funcName = "";

	let paramRegs: inst.TypedReg[] = [];
	callExpression.arguments.forEach(exp => {
		const expReg = processExpression(exp); //TODO: handle unsaved expressions
		let argType = cgm.checker.getTypeAtLocation(exp);
		if (argType.getFlags() == ts.TypeFlags.Any) {
			argType = cgm.checker.getContextualType(exp)!;
		}
		paramRegs.push({
			reg: expReg, type: argType
		});
	});

	let retType: ts.Type | null = cgm.checker.getTypeAtLocation(callExpression);
	//TODO: remove handling console.log and replace with printf
	if (callExpression.expression.kind == ts.SyntaxKind.Identifier) {
		funcName = (callExpression.expression as ts.Identifier).text;
	}
	else if (callExpression.expression.kind == ts.SyntaxKind.PropertyAccessExpression &&
		 callExpression.expression.getText() == "console.log") {

		retType = null;
		//TODO: handle multiple arguments and other argument types
		let argType = cgm.checker.getTypeAtLocation(callExpression.arguments[0]).flags;
		if (argType & ts.TypeFlags.String) {
			funcName = "prints";
		}
		if (argType & ts.TypeFlags.Number) {
			funcName = "printd";
		}
	}
	else {
		let imported: boolean = false;
		if ((callExpression.expression as ts.PropertyAccessExpression).expression.kind == ts.SyntaxKind.ThisKeyword) {
			let objType: ts.Type = cgm.checker.getTypeAtLocation((callExpression.expression as ts.PropertyAccessExpression).expression);
			funcName =  objType.getSymbol()!.getName();
			paramRegs.push({ reg: cgm.regMap.get('this')!, type: objType})
		}
		else {
			funcName =  ((callExpression.expression as ts.PropertyAccessExpression).expression as ts.Identifier).getText();
			imported = true;
		}
		funcName += '_' + (callExpression.expression as ts.PropertyAccessExpression).name.getText();
		if (imported && (importedFunctions.indexOf(funcName) == -1) ) {
			importedFunctions.push(funcName);
			importedFunctionsNodes.push(callExpression.expression as ts.PropertyAccessExpression);
			let paramTypes: ts.Type[] = paramRegs.map(reg => reg.type as ts.Type);
			cgm.iBuff.emitFunctionDeclaration(new inst.FunctionDeclarationInstruction(funcName, retType, paramTypes))
		}
	}

	if (libFunctions.indexOf(funcName) > -1) {
		return emitLibFuncitonCall(callExpression).reg;
	}

	return emitFunctionCall(retType, funcName, paramRegs).reg;
}


import * as ts from "typescript"

import * as cgm from "./manager.js"
import * as inst from "./llvm/instructions"
import * as cg_utils from "./code_gen_utils"
import * as llvm_utils from "./llvm/utils"
import { emitFunctionCall, emitGetPropertyAddress, emitLoadProperty } from "./llvm/emit"

function processArithmeticBinaryExpression(exp: ts.BinaryExpression): number {
	const leftReg = processExpression(exp.left);
	const rightReg = processExpression(exp.right);
	const resReg = cgm.iBuff.getNewReg();
	//TODO: wrap this emit with an emitter function
	cgm.iBuff.emit(new inst.NumericOpInstruction(resReg, leftReg, rightReg, exp.operatorToken.kind));
	return resReg;
}

function processNewExpression(newExp: ts.NewExpression): number {
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

function processAssignmentExpression(exp: ts.BinaryExpression): number {
	let rightReg = processExpression(exp.right);
	if (exp.left.kind == ts.SyntaxKind.Identifier) {
		cgm.regMap.set((exp.left as ts.Identifier).getText(), rightReg);
	}
	else {
		//TODO: add assertion of the property access being a property and not function
		let leftReg = emitGetPropertyAddress(exp.left as ts.PropertyAccessExpression);
		cgm.iBuff.emit(new inst.StoreInstruction(leftReg, rightReg, cgm.checker.getTypeAtLocation(exp.right)));
	}
	return rightReg;
}

export function processExpression(exp: ts.Expression): number {
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
			return processNewExpression(exp as ts.NewExpression);
			break;
		case ts.SyntaxKind.PropertyAccessExpression:
			//TODO: replace with processPropertyAccessExpression
			return emitLoadProperty(exp as ts.PropertyAccessExpression);
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
		return processAssignmentExpression(binaryExpression as ts.BinaryExpression);
	}
	else if (typeFlags & ts.TypeFlags.Number) {
		return processArithmeticBinaryExpression(binaryExpression as ts.BinaryExpression);
	}
	else {
		throw new Error('unsupported expression type');
	}
}

function processCallExpression(callExpression: ts.CallExpression): number {

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
	let funcName = llvm_utils.leftHandSideExpressionToLlvmName(callExpression.expression);
	let imported: boolean = cg_utils.isCallExpressionImported(callExpression);

	if (cg_utils.isMethodCall(callExpression)) {
		let objType: ts.Type = cgm.checker.getTypeAtLocation((callExpression.expression as ts.PropertyAccessExpression).expression);
		paramRegs.push({ reg: cgm.regMap.get('this')!, type: objType})
	}

	if (imported && (cgm.importedFunctions.indexOf(funcName) == -1) ) {
		cgm.importedFunctions.push(funcName);
		cgm.importedFunctionsNodes.push(callExpression.expression as ts.PropertyAccessExpression);
		let paramTypes: ts.Type[] = paramRegs.map(reg => reg.type as ts.Type);
		cgm.iBuff.emitFunctionDeclaration(new inst.FunctionDeclarationInstruction(funcName, retType, paramTypes))
	}

	return emitFunctionCall(retType, funcName, paramRegs);
}


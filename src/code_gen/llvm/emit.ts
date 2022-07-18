
//TODO: merge with instruction buffer into an emitter class

import * as ts from "typescript"

import * as cgm from "../manager"
import * as inst from "./instructions"
import * as cg_utils from "../code_gen_utils"

//TODO: discard this function or split it to smaller tasks
export function emitFunctionDefinition(fun: ts.FunctionLikeDeclaration, cls?: ts.Type): void {
	const signature = cgm.checker.getSignatureFromDeclaration(fun)!;
	let paramTypes: ts.Type[] = [];
	cgm.regMap.clear();
	for (let i = 0; i < signature.parameters.length; i++) {
		const paramSymbol = signature.parameters[i];
		cgm.regMap.set(paramSymbol.getName(), -(i + 1)); //TODO: find an elegant representations of function arguments
		paramTypes.push(cg_utils.getSymbolTypeFlags(paramSymbol));
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

export function emitFunctionCall(retType: ts.Type | null, name: string, paramRegs: inst.TypedReg[]): number {
	//TODO: remove allocating new reg for void functions
	const retReg: inst.TypedReg = {
		reg: cgm.iBuff.getNewReg(),
		type: retType
	};
	cgm.iBuff.emit(new inst.FunctionCallInstruction(retReg, name, paramRegs));
	return retReg.reg;
}

export function emitGetPropertyAddress(exp: ts.PropertyAccessExpression): number {
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
	return ptrReg;
}

export function emitLoadProperty(exp: ts.PropertyAccessExpression): number {
	let addressReg = emitGetPropertyAddress(exp);
	let resReg = cgm.iBuff.getNewReg();
	let valType: ts.Type = cgm.checker.getTypeAtLocation(exp);
	cgm.iBuff.emit(new inst.LoadInstruction(addressReg, resReg, valType))
	return resReg;
}
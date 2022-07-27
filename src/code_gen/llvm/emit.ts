
//TODO: merge with instruction buffer into an emitter class

import * as ts from "typescript"

import * as cgm from "../manager"
import * as inst from "./instructions"
import * as cg_utils from "../code_gen_utils"

//TODO: discard this function or split it to smaller tasks
export function emitFunctionDefinition(fun: ts.FunctionLikeDeclaration, cls?: ts.Type): void {
	const signature = cgm.checker.getSignatureFromDeclaration(fun)!;
	let paramTypes: ts.Type[] = [];
	cgm.symbolTable.clear();
	for (let i = 0; i < signature.parameters.length; i++) {
		const paramSymbol = signature.parameters[i];
		cgm.symbolTable.set(paramSymbol.getName(), -(i + 1)); //TODO: find an elegant representations of function arguments
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
		cgm.symbolTable.set('this', -(signature.parameters.length + 1));
	}
	cgm.iBuff.emit(new inst.FunctionDefinitionInstruction(id, retType, paramTypes));
}

export function emitBinaryBooleanOperation(leftReg: number, rightReg: number, operator: ts.BinaryOperator): number {
	let resReg = cgm.iBuff.getNewReg();
	cgm.iBuff.emit(new inst.EqualityOpInstruction(resReg, leftReg, rightReg, operator));
	return resReg;
}

export function emitFunctionCall(retType: ts.Type | null, name: string, paramRegs: inst.TypedReg[]): number {
	//TODO: remove allocating new reg for void functions
	const retReg: inst.TypedReg = {
		reg: cgm.iBuff.getNewReg(),
		type: retType
	};
	cgm.iBuff.emit(new inst.FunctionCallInstruction(retReg, name, paramRegs));
	return retReg.reg;
}

export function emitGetPropertyAddress(objAddressReg: number, objType: ts.Type, propertyName: string): number {
	let propertyAddresReg: number = cgm.iBuff.getNewReg();
	let objPropNames = cgm.checker.getPropertiesOfType(objType).filter(sym => sym.flags == ts.SymbolFlags.Property).map(sym => sym.getName());
	let propIndex: number = objPropNames.indexOf(propertyName);

	cgm.iBuff.emit(new inst.GetElementInstruction(propertyAddresReg, objAddressReg, objType, propIndex))
	return propertyAddresReg;
}

// export function emitLoadProperty(exp: ts.PropertyAccessExpression): number {
// 	let addressReg = emitGetPropertyAddress(exp);
// 	let resReg = cgm.iBuff.getNewReg();
// 	let valType: ts.Type = cgm.checker.getTypeAtLocation(exp);
// 	cgm.iBuff.emit(new inst.LoadInstruction(addressReg, resReg, valType))
// 	return resReg;
// }

export function emitNegationInstruction(argReg: number): number {
	const resReg = cgm.iBuff.getNewReg();
	cgm.iBuff.emit(new inst.NegationInstruction(resReg, argReg));
	return resReg;
}

export function emitStaticAllocation(type: ts.Type): number {
	const resReg = cgm.iBuff.getNewReg();
	cgm.iBuff.emit(new inst.StaticAllocationInstruction(resReg, type));
	return resReg;
}

export function emitLoadVariable(addressReg: number, type: ts.Type): number {
	const resReg = cgm.iBuff.getNewReg();
	cgm.iBuff.emit(new inst.LoadInstruction(addressReg, resReg, type));
	return resReg;
}

export function emitIncrement(valueReg: number): number {
	const resReg = cgm.iBuff.getNewReg();
	cgm.iBuff.emit(new inst.IncrementInstruction(resReg, valueReg));
	return resReg;
}

export function emitPostfixIncrement(addressReg: number): number {
	const type = cg_utils.numberType();
	const valueReg = emitLoadVariable(addressReg, type);
	const incrementedReg = emitIncrement(valueReg);
	cgm.iBuff.emit(new inst.StoreInstruction(addressReg, incrementedReg, type));
	return addressReg;
}

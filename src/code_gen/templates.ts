
import * as ts from "typescript";

import { iBuff, checker } from "./manager.js"
import * as inst from "../ir/instructions.js"


export function emitObjectAllocationFunctionDefinition(type: ts.Type): void {

	const func_name: string = "allocate_" +  type.getSymbol()!.getName();

	let regs: number[] = [...Array(4)].map((_) => iBuff.getNewReg());
	let template: inst.Instruction[] = [
		new inst.FunctionDeclarationInstruction(func_name, type, []),
		new inst.GetElementSizeInstruction(regs[0], type),
		new inst.PtrToIntInstruction(regs[1], regs[0], type),
		new inst.DynamicAllocationInstruction(regs[2], regs[1]),
		new inst.BitCastInstruction(regs[3], regs[2], type),
		new inst.ReturnInstruction(type, regs[3]),
		new inst.FunctionEndInstruction()
	];

	template.forEach((inst) => iBuff.emit(inst));
}

export function emitObjectFieldGetter(objType: ts.Type, fieldSymbol: ts.Symbol, fieldType: ts.Type, index: number): void {

	const func_name: string = 'get_' + fieldSymbol.getName() + '_' + objType.getSymbol()!.getName();

	//TODO: add a reg allocation function instead of this line
	let regs: number[] = [...Array(2)].map((_) => iBuff.getNewReg());
	let template: inst.Instruction[] = [
		new inst.FunctionDeclarationInstruction(func_name, fieldType, [objType]),
		new inst.GetElementInstruction(regs[0], -1, objType, index),
		new inst.LoadInstruction(regs[0], regs[1], fieldType),
		new inst.ReturnInstruction(fieldType, regs[1]),
		new inst.FunctionEndInstruction()
	];

	template.forEach((inst) => iBuff.emit(inst));
}

export function emitObjectFieldSetter(objType: ts.Type, fieldSymbol: ts.Symbol, fieldType: ts.Type, index: number): void {

	const func_name: string = 'set_' + fieldSymbol.getName() + '_' + objType.getSymbol()!.getName();

	//TODO: add a reg allocation function instead of this line
	let reg: number = iBuff.getNewReg();
	let template: inst.Instruction[] = [
		new inst.FunctionDeclarationInstruction(func_name, null, [fieldType, objType]),
		new inst.GetElementInstruction(reg, -2, objType, index),
		new inst.StoreInstruction(reg, -1, fieldType),
		new inst.ReturnInstruction(null),
		new inst.FunctionEndInstruction()
	];

	template.forEach((inst) => iBuff.emit(inst));
}

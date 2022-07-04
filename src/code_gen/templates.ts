
import * as ts from "typescript";

import { iBuff } from "./manager.js"
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

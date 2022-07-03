
import * as ts from "typescript";

import { typeToLlvmType, typeFlagsToLlvmType, regIndexToString, labelIndexToString } from "./utils.js"

export type TypedReg = {
	reg: number;
	type: ts.Type | null;
}

export type BpEntry = {
	instruction: number;
	index: 0 | 1; //0 means the first label of the instruction, 1 means the second (should be 0 for single label instructions)
}

export interface Instruction {
	toLlvm(): string;
}

export interface PatchableInstruction extends Instruction {
	patch(label: number, index: 0 | 1): void;
}

export class FunctionDeclarationInstruction implements Instruction {
	private id: string;
	private retType: ts.Type | null;
	private paramTypes: ts.Type[];

	constructor(id: string, retType: ts.Type | null, paramTypes: ts.Type[]) {
		this.id = id;
		this.retType = retType;
		this.paramTypes = paramTypes;
	}

	toLlvm(): string {
		let out = "define " + typeToLlvmType(this.retType, true) + " @" + this.id + "(";
		for (let i = 0; i < this.paramTypes.length; i++) {
			if (i != 0) {
				out += ", ";
			}
			out += typeToLlvmType(this.paramTypes[i], true);
		}
		out += ") {";
		return out;
	}
}

export class FunctionEndInstruction implements Instruction {
	toLlvm(): string {
		return "}\n";
	}
}

export class NumericAssignmentInstruction implements Instruction {
	private reg: number;
	private val: number;

	constructor(reg: number, val: number) {
		this.reg = reg;
		this.val = val;
	}

	toLlvm(): string {
		let llvm_val: string = this.val.toString();
		if (Number.isInteger(this.val)) {
			llvm_val += ".0";
		}
		return regIndexToString(this.reg) + ' = fadd ' + typeFlagsToLlvmType(ts.TypeFlags.Number) + ' 0.0, ' + llvm_val;
	}
}

export class NumericOpInstruction implements Instruction {
	private resReg: number;
	private leftReg: number;
	private rightReg: number;
	private op: ts.BinaryOperator;

	constructor(resReg: number, leftReg: number, rightReg: number, op: ts.BinaryOperator) {
		this.resReg = resReg;
		this.leftReg = leftReg;
		this.rightReg = rightReg;
		this.op = op; //TODO: check that op is of supported token
	}

	toLlvm(): string {
		let llvmOp: string;
		switch (this.op) {
			case ts.SyntaxKind.PlusToken:
				llvmOp = "fadd";
				break;
			case ts.SyntaxKind.MinusToken:
				llvmOp = "fsub";
				break;
			case ts.SyntaxKind.AsteriskToken:
				llvmOp = "fmul";
				break;
			case ts.SyntaxKind.SlashToken:
				llvmOp = "fdiv";
				break;
			default:
				llvmOp = "unsupported-op";
		}
		return regIndexToString(this.resReg) + " = " + llvmOp + " " + typeFlagsToLlvmType(ts.TypeFlags.Number) + " " + regIndexToString(this.leftReg) + ", " +  regIndexToString(this.rightReg);
	}
}

export class EqualityOpInstruction implements Instruction {
	//TODO: merge somehow with NumericOpInstruction
	private resReg: number;
	private leftReg: number;
	private rightReg: number;
	private op: ts.BinaryOperator;

	constructor(resReg: number, leftReg: number, rightReg: number, op: ts.BinaryOperator) {
		this.resReg = resReg;
		this.leftReg = leftReg;
		this.rightReg = rightReg;
		this.op = op;
	}

	toLlvm(): string {
		let llvmCond: string;
		switch (this.op) {
			case ts.SyntaxKind.LessThanToken:
				llvmCond = "olt";
				break;
			case ts.SyntaxKind.LessThanEqualsToken:
				llvmCond = "ole";
				break;
			case ts.SyntaxKind.GreaterThanToken:
				llvmCond = "ogt";
				break;
			case ts.SyntaxKind.GreaterThanEqualsToken:
				llvmCond = "oge";
				break;
			case ts.SyntaxKind.EqualsEqualsToken:
				llvmCond = "oeq";
				break;
			case ts.SyntaxKind.ExclamationEqualsToken:
				llvmCond = "one";
				break;
			default:
				llvmCond = "unsupported-cond";
		}
		return regIndexToString(this.resReg) + " = fcmp " + llvmCond + " " + typeFlagsToLlvmType(ts.TypeFlags.Number) + " " + regIndexToString(this.leftReg) + ", " +  regIndexToString(this.rightReg);
	}
}

export class ReturnInstruction implements Instruction {
	private retType: ts.Type | null;
	private reg: number = 0;

	constructor(retType: ts.Type | null, reg?: number) {
		this.retType = retType;
		if (reg) {
			this.reg = reg;
		}
	}

	toLlvm(): string {
		let out = "ret " + typeToLlvmType(this.retType, true);
		if (this.retType == null || (this.retType.flags & ts.TypeFlags.Void)) {
			return out;
		}
		out += ' ' + regIndexToString(this.reg);
		return out;
	}
}


export class FunctionCallInstruction implements Instruction {
	private resReg: TypedReg;
	private name: string;
	private paramRegs: TypedReg[];

	constructor(resReg: TypedReg, name: string, paramRegs: TypedReg[]) {
		this.resReg = resReg;
		this.name = name;
		this.paramRegs = paramRegs;
	}

	toLlvm(): string {
		let out = "";
		if (this.resReg.type != null && !(this.resReg.type.flags & ts.TypeFlags.Void)) {
			out += regIndexToString(this.resReg.reg) + " = ";
		}
		out += "call " + typeToLlvmType(this.resReg.type, true);
		if (this.paramRegs.length != 0) {
			out += " (";
			for (let i = 0; i < this.paramRegs.length; i++) {
				if (i != 0) {
					out += ", ";
				}
				out += typeToLlvmType(this.paramRegs[i].type, true);
			}
			out += ")";
		}
		out += " @" + this.name + "(";
		for (let i = 0; i < this.paramRegs.length; i++) {
			if (i != 0) {
				out += ", ";
			}
			const typedReg = this.paramRegs[i];
			out += typeToLlvmType(typedReg.type, true) + " " + regIndexToString(typedReg.reg);
		}
		out += ")";
		return out;
	}
}

export class AllocationInstruction implements Instruction {
	private resReg: number;
	private type: ts.Type;

	constructor(resReg: number, type: ts.Type) {
		this.resReg = resReg;
		this.type = type;
	}


	toLlvm(): string {
		return regIndexToString(this.resReg) + ' = alloca %' + this.type.getSymbol()!.getName(); //TODO: implement
	}
}

export class StoreInstruction implements Instruction {
	private addressReg: number;
	private valueReg: number;
	private valueType: ts.Type;

	constructor(addressReg: number, valueReg: number, valueType: ts.Type) {
		this.addressReg = addressReg;
		this.valueReg = valueReg;
		this.valueType = valueType;
	}


	toLlvm(): string {
		return 'store ' + typeToLlvmType(this.valueType) + ' ' + regIndexToString(this.valueReg) + ', ' + typeToLlvmType(this.valueType) + '* ' + regIndexToString(this.addressReg);
	}
}

export class LoadInstruction implements Instruction {
	private addressReg: number;
	private valueReg: number;
	private valueType: ts.Type;

	constructor(addressReg: number, valueReg: number, valueType: ts.Type) {
		this.addressReg = addressReg;
		this.valueReg = valueReg;
		this.valueType = valueType;
	}

	toLlvm(): string {
		let llvmType = typeToLlvmType(this.valueType);
		return regIndexToString(this.valueReg) + ' = load ' + llvmType + ', ' + llvmType + '* ' + regIndexToString(this.addressReg);
	}
}
export class GetElementInstruction implements Instruction {
	private resReg: number;
	private objPtrReg: number;
	private objType: ts.Type;
	private propertyIndex: number;

	constructor(resReg: number, objPtrReg: number, objType: ts.Type, propertyIndex: number) {
		this.resReg = resReg;
		this.objPtrReg = objPtrReg;
		this.objType = objType;
		this.propertyIndex = propertyIndex;
	}

	toLlvm(): string {
		return regIndexToString(this.resReg) + ' = getelementptr ' + typeToLlvmType(this.objType) + ', ' + typeToLlvmType(this.objType) + '* ' + regIndexToString(this.objPtrReg) + ' , i32 0, i32 ' + this.propertyIndex;
	}
}

export class GetElementSizeInstruction implements Instruction {
	//TODO: combine with GetElementInstruction class somehow
	private resReg: number;
	private objType: ts.Type;

	constructor(resReg: number, objType: ts.Type) {
		this.resReg = resReg;
		this.objType = objType;
	}

	toLlvm(): string {
		return regIndexToString(this.resReg) + ' = getelementptr ' + typeToLlvmType(this.objType) + ', ' + typeToLlvmType(this.objType, true) + '* null, i32 1';
	}
}

export class LabelInstruction implements Instruction {
	private static count = 0;

	public index;

	constructor() {
		this.index = LabelInstruction.count;
		LabelInstruction.count++;
	}

	toLlvm(): string {
		return 'l' + this.index.toString() + ':';
	}
}

export class ConditionalBranchInstruction implements PatchableInstruction {
	private boolReg:number;
	private trueLabel:number;
	private falseLabel:number;

	constructor(boolReg: number, trueLabel?: number, falseLabel?:number) {
		this.boolReg = boolReg;
		this.trueLabel = trueLabel ? trueLabel : -1;
		this.falseLabel = falseLabel ? falseLabel : -1;
	}

	patch(label: number, index: 0 | 1): void {
		if (index == 0) {
			this.trueLabel = label;
		}
		else {
			this.falseLabel = label;
		}
	}

	toLlvm(): string {
		return "br i1 " + regIndexToString(this.boolReg) + ", label " + labelIndexToString(this.trueLabel) + ", label " + labelIndexToString(this.falseLabel)
	}
}

export class StructDefinitionInstruction implements Instruction {
	private name: string;
	private typesList: ts.TypeFlags[];

	constructor(name: string, typesList: ts.TypeFlags[]) {
		this.name = name;
		this.typesList = typesList;
	}

	toLlvm(): string {
		let out = '%' + this.name + ' = type {\n'
		for (let i = 0; i < this.typesList.length; i++) {
			out += '\t' + typeFlagsToLlvmType(this.typesList[i]);
			if (i != this.typesList.length - 1) {
				out += ",";
			}
			out += '\n';
		}
		out += '}\n';
		return out;
	}
}

export class PtrToIntInstruction implements Instruction {
	private dstReg: number;
	private srcReg: number;
	private srcType: ts.Type;

	constructor(dstReg: number, srcReg: number, srcType: ts.Type) {
		this.dstReg = dstReg;
		this.srcReg = srcReg;
		this.srcType = srcType;
	}

	toLlvm(): string {
		return regIndexToString(this.dstReg) + " = ptrtoint " + typeToLlvmType(this.srcType, true) + " " + regIndexToString(this.srcReg) + " to i32";
	}
}

export class DynamicAllocationInstruction implements Instruction {
	private dstReg: number;
	private argReg: number;

	constructor(dstReg: number, argReg: number) {
		this.dstReg = dstReg;
		this.argReg = argReg;
	}

	toLlvm(): string {
		return regIndexToString(this.dstReg) + " = call i8* (i32) @malloc(i32 " + regIndexToString(this.argReg) + ")"
	}
}

export class BitCastInstruction implements Instruction {
	//TODO: generalize source type
	private dstReg: number;
	private srcReg: number;
	private dstType: ts.Type;

	constructor(dstReg: number, srcReg: number, dstType: ts.Type) {
		this.dstReg = dstReg;
		this.srcReg = srcReg;
		this.dstType = dstType;
	}

	toLlvm(): string {
		return regIndexToString(this.dstReg) + " = bitcast i8* " + regIndexToString(this.srcReg) + " to " + typeToLlvmType(this.dstType, true);
	}
}

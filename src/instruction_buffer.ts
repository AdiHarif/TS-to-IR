
import * as ts from "typescript";

function typeFlagsToLlvmType(typeFlags: ts.TypeFlags): string {
	if (typeFlags & ts.TypeFlags.Void) {
		return 'void';
	}
	if (typeFlags & ts.TypeFlags.Number) {
		return 'double';
	}
	if (typeFlags & ts.TypeFlags.Boolean) {
		return 'i1';
	}
	return 'unsupported-type';
}

function regIndexToString(reg: number): string {
	if (reg < 0) { //i.e. this is a function variable
		return '%' + (-1 - reg).toString();
	}
	return '%r' + reg.toString();
}

interface Instruction {
	toLlvm(): string;
}

interface PatchableInstruction extends Instruction {
	patch(label: number): void;
}

export class FunctionDeclarationInstruction implements Instruction {
	private id: string;
	private retType: ts.TypeFlags;
	private paramTypes: ts.TypeFlags[];

	constructor(id: string, retType: ts.TypeFlags, paramTypes: ts.TypeFlags[]) {
		this.id = id;
		this.retType = retType;
		this.paramTypes = paramTypes;
	}

	toLlvm(): string {
		return ""; //TODO: implement
	}
}

export class NumericInstruction implements Instruction {
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

export class ReturnInstruction implements Instruction {
	private typeFlags: ts.TypeFlags;
	private reg: number = 0;

	constructor(typeFlags: ts.TypeFlags, reg?: number) {
		this.typeFlags = typeFlags;
		if (reg) {
			this.reg = reg;
		}
	}

	toLlvm(): string {
		let out = "ret " + typeFlagsToLlvmType(this.typeFlags);
		if (!(this.typeFlags & ts.TypeFlags.Void)) {
			out += ' ' + regIndexToString(this.reg);
		}
		return out;
	}
}

export type TypedReg = {
	reg: number;
	typeFlags: ts.TypeFlags;
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
		if (!(this.resReg.typeFlags & ts.TypeFlags.Void)) {
			out += regIndexToString(this.resReg.reg) + " = ";
		}
		out += "call " + typeFlagsToLlvmType(this.resReg.typeFlags);
		if (this.paramRegs.length != 0) {
			out += " (";
			for (let i = 0; i < this.paramRegs.length; i++) {
				if (i != 0) {
					out += ", ";
				}
				out += typeFlagsToLlvmType(this.paramRegs[i].typeFlags);
			}
			out += ")";
		}
		out += " @" + this.name + "(";
		for (let i = 0; i < this.paramRegs.length; i++) {
			if (i != 0) {
				out += ", ";
			}
			const typedReg = this.paramRegs[i];
			out += typeFlagsToLlvmType(typedReg.typeFlags) + " " + regIndexToString(typedReg.reg);
		}
		out += ")";
		return out;
	}
}

class LabelInstruction implements Instruction {
	private static count = 0;

	public index;

	constructor() {
		this.index = LabelInstruction.count;
		LabelInstruction.count++;
	}

	toLlvm(): string {
		return 'l' + this.index.toString();
	}
}

class JumpInstruction implements PatchableInstruction {
	private label: number = -1;

	toLlvm(): string {
		return ""; //TODO: implement
	}

	patch(label: number): void {
		this.label = label;
	}
}

export class InstructionBuffer {
	private codeBuffer: Instruction[] = [];
	private dataBuffer: Instruction[] = [];
	private globalCodeBuffer: Instruction[] = [];
	private regCount: number = 0;

	constructor() {}

	emit(inst: Instruction): number {
		this.codeBuffer.push(inst);
		return this.codeBuffer.length - 1;
	}

	emitData(inst: Instruction): number {
		this.dataBuffer.push(inst);
		return this.dataBuffer.length - 1;
	}

	emitNewLabel(): number {
		const label = new LabelInstruction();
		this.emit(label);
		return label.index;
	}

	emitNewJump(): number {
		const jump = new JumpInstruction();
		return this.emit(jump);
	}

	getNewReg(): number {
		return ++this.regCount;
	}

	backPatch(locations: number[], label: number) {
		locations.forEach(loc => (this.codeBuffer[loc] as PatchableInstruction).patch(label));
	}

	dumpBuffer(): string {
		let code: string = "";
		this.dataBuffer.forEach(instruction => code = code + instruction.toLlvm() + '\n');
		this.codeBuffer.forEach(instruction => {
			if (instruction instanceof FunctionDeclarationInstruction) {
				code += "\t";
			}
			code += instruction.toLlvm() + '\n'
		});
		return code;
	}

}

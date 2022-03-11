
import * as ts from "typescript";

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
		return ""; //TODO: implement
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
		return this.regCount++;
	}

	backPatch(locations: number[], label: number) {
		locations.forEach(loc => (this.codeBuffer[loc] as PatchableInstruction).patch(label));
	}

	dumpBuffer(): string {
		let code: string = "";
		this.dataBuffer.forEach(instruction => code = code + instruction.toLlvm() + '\n');
		this.codeBuffer.forEach(instruction => code = code + instruction.toLlvm() + '\n');
		return code;
	}

}

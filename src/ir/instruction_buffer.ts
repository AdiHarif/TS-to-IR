
import { Instruction, StructDefinitionInstruction, LabelInstruction, PatchableInstruction, BpEntry, FunctionDeclarationInstruction, FunctionEndInstruction } from "./instructions.js"
export class InstructionBuffer {
	private codeBuffer: Instruction[] = [];
	private dataBuffer: Instruction[] = [];
	private structsBuffer: StructDefinitionInstruction[] = [];
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

	emitStructDefinition(inst: StructDefinitionInstruction): number {
		this.structsBuffer.push(inst);
		return this.structsBuffer.length - 1;
	}

	emitNewLabel(): number {
		const label = new LabelInstruction();
		this.emit(label);
		return label.index;
	}

	getNewReg(): number {
		return ++this.regCount;
	}

	backPatch(entries: BpEntry[], label: number) {
		entries.forEach(ent => (this.codeBuffer[ent.instruction] as PatchableInstruction).patch(label, ent.index));
	}

	dumpBuffer(): string {
		//TODO: change handling declerations in a more dynamic way
		const declerations: string = (
			'declare double @scand()\n' +
			'declare void @printd(double)\n' +
			'declare void @prints(i8*)\n' +
			'\n'
		);
		let code: string = declerations;
		this.dataBuffer.forEach(instruction => code = code + instruction.toLlvm() + '\n');
		this.structsBuffer.forEach(instruction => code = code + instruction.toLlvm() + '\n');
		this.codeBuffer.forEach(instruction => {
			if (!((instruction instanceof FunctionDeclarationInstruction) ||
			      (instruction instanceof FunctionEndInstruction))) {
				code += "\t";
			}
			code += instruction.toLlvm() + '\n'
		});
		return code;
	}

}

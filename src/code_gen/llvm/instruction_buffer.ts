
//TODO: cleanup this import
import { Instruction, StructDefinitionInstruction, LabelInstruction, FunctionDefinitionInstruction, FunctionDeclarationInstruction, FunctionEndInstruction } from "./instructions.js"
export class InstructionBuffer {
	private declarationsBuffer: FunctionDeclarationInstruction[] = [];
	private dataBuffer: Instruction[] = [];
	private structsBuffer: StructDefinitionInstruction[] = [];
	private codeBuffer: Instruction[] = [];
	private regCount: number = 0;

	constructor() {}

	emit(inst: Instruction): number {
		this.codeBuffer.push(inst);
		return this.codeBuffer.length - 1;
	}

	emitFunctionDeclaration(inst: FunctionDeclarationInstruction): void {
		this.declarationsBuffer.push(inst);
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

	dumpBuffer(): string {
		//TODO: change handling declerations in a more dynamic way
		const declerations: string = (
			'declare double @scand()\n' +
			'declare void @printd(double)\n' +
			'declare void @prints(i8*)\n' +
			'declare i8* @malloc(i32)\n' +
			'\n'
		);
		let code: string = declerations;
		this.declarationsBuffer.forEach(instruction => code += instruction.toLlvm() + '\n');
		code += '\n';
		this.dataBuffer.forEach(instruction => code = code + instruction.toLlvm() + '\n');
		this.structsBuffer.forEach(instruction => code = code + instruction.toLlvm() + '\n');
		this.codeBuffer.forEach(instruction => {
			if (!((instruction instanceof FunctionDefinitionInstruction) ||
			      (instruction instanceof FunctionEndInstruction))) {
				code += "\t";
			}
			code += instruction.toLlvm() + '\n'
		});
		return code;
	}

}

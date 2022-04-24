
import * as ts from "typescript";

function typeToLlvmType(type: ts.Type | null): string {
	if (type == null) {
		return typeFlagsToLlvmType(ts.TypeFlags.Void);
	}
	if (type.isClass()) {
		return '%' + type.symbol.getName() + '*';
	}
	return typeFlagsToLlvmType(type.getFlags());
}

function typeFlagsToLlvmType(typeFlags: ts.TypeFlags): string {
	if (typeFlags & ts.TypeFlags.Void) {
		return 'void';
	}
	if ((typeFlags & ts.TypeFlags.Number) ||
	    (typeFlags & ts.TypeFlags.NumberLiteral)) {
		return 'double';
	}
	if (typeFlags & ts.TypeFlags.Boolean) {
		return 'i1';
	}
	return 'unsupported-type(' + ts.TypeFlags[typeFlags] + ')';
}

function regIndexToString(reg: number): string {
	if (reg == undefined) {
		return 'undefined-reg'
	}
	if (reg < 0) { //i.e. this is a function variable
		return '%' + (-1 - reg).toString();
	}
	return '%r' + reg.toString();
}

function labelIndexToString(label: number): string {
	return "%l" + label.toString()
}

interface Instruction {
	toLlvm(): string;
}

interface PatchableInstruction extends Instruction {
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
		let out = "define " + typeToLlvmType(this.retType) + " @" + this.id + "(";
		for (let i = 0; i < this.paramTypes.length; i++) {
			if (i != 0) {
				out += ", ";
			}
			out += typeToLlvmType(this.paramTypes[i]);
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
		return regIndexToString(this.reg) + " = fadd double 0.0, " + llvm_val;
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

class LabelInstruction implements Instruction {
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

export type BpEntry = {
	instruction: number;
	index: 0 | 1; //0 means the first label of the instruction, 1 means the second (should be 0 for single label instructions)
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

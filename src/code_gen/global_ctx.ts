
import * as ts from "typescript";
import * as path from "node:path"

import * as ib from "./llvm/instruction_buffer.js"
import * as cmd from "../cmd_line"

//TODO: move regMap from here to local function ctx
export let regMap: Map<string, number> = new Map<string, number>();

export class GlobalCtx {
	readonly irOutputPath: string;
	readonly wrapperOutputPath: string;

	readonly program: ts.Program;
	readonly checker: ts.TypeChecker;
	readonly printer: ts.Printer;

	readonly llvmBuffer: ib.InstructionBuffer;

	constructor(args: cmd.CommandLineArguments) {
		const fileName: string = path.parse(args.sourceFilePath).name;
		this.irOutputPath = path.join(args.outputDir, `${fileName}.llvm`);
		const fileBase: string = path.parse(args.sourceFilePath).base;
		this.wrapperOutputPath = path.join(args.outputDir, fileBase);

		//TODO: add compiler options handling
		//TODO: check if the programs syntax\semantics are ok
		this.program = ts.createProgram([ args.sourceFilePath ], {});
		this.checker = this.program.getTypeChecker();
		this.printer = ts.createPrinter();

		this.llvmBuffer = new ib.InstructionBuffer();
	}

	getSourceFile(): ts.SourceFile {
		return this.program.getSourceFiles().filter(sf => !sf.isDeclarationFile)[0];
	}
}

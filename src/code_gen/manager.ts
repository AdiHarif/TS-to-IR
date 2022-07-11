
import * as ts from "typescript";
import * as path from "node:path"

import * as ib from "../ir/instruction_buffer.js"

export let sourceFiles: readonly ts.SourceFile[] = [];
export let checker: ts.TypeChecker;
export let printer: ts.Printer;
export let iBuff: ib.InstructionBuffer;
export let regMap: Map<string, number>;
export let irOutputPath: string;
export let wrapperOutputPath: string;

export function InitManager(sourceFile: string, outputDir: string): void {
	const options: ts.CompilerOptions = {
	};
	const program = ts.createProgram([ sourceFile ] , options); //TODO: add compiler options handling
	sourceFiles = program.getSourceFiles();
	sourceFiles = sourceFiles.filter(sf => !sf.isDeclarationFile);
	//TODO: check if the programs syntax\semantics are ok

	checker = program.getTypeChecker();
	printer = ts.createPrinter();
	iBuff = new ib.InstructionBuffer();
	regMap = new Map<string, number>();

	const fileName: string = path.parse(sourceFile).name;
	irOutputPath = path.join(outputDir, `${fileName}.llvm`);
	const fileBase: string = path.parse(sourceFile).base;
	wrapperOutputPath = path.join(outputDir, fileBase);
}

import * as ts from "typescript";
import * as path from "node:path"

import * as ib from "./llvm/instruction_buffer.js"

let program: ts.Program;
let sourceFilePath: string;

//TODO: find a more suitable place for this list.
export let importedFunctions: string[];

//TODO: merge with importedFunctions (maybe wrap with an imports class?) and make more general
export let importedFunctionsNodes: ts.PropertyAccessExpression[];

export let checker: ts.TypeChecker;
export let printer: ts.Printer;
export let iBuff: ib.InstructionBuffer;
export let regMap: Map<string, number>;
export let irOutputPath: string;
export let wrapperOutputPath: string;

export function InitManager(sourceFile: string, outputDir: string): void {
	const options: ts.CompilerOptions = {
	};
	program = ts.createProgram([ sourceFile ] , options); //TODO: add compiler options handling
	//TODO: check if the programs syntax\semantics are ok

	sourceFilePath = sourceFile;
	checker = program.getTypeChecker();
	printer = ts.createPrinter();
	iBuff = new ib.InstructionBuffer();
	regMap = new Map<string, number>();

	const fileName: string = path.parse(sourceFile).name;
	irOutputPath = path.join(outputDir, `${fileName}.llvm`);
	const fileBase: string = path.parse(sourceFile).base;
	wrapperOutputPath = path.join(outputDir, fileBase);

	importedFunctions = [];
	importedFunctionsNodes = [];
}

export function getSourceFile(): ts.SourceFile {
	return program.getSourceFiles().filter(sf => !sf.isDeclarationFile)[0];
}

export function getWasmFileName(): string {
	return `${path.parse(sourceFilePath).name}.wasm`
}

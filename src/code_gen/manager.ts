
import * as ts from "typescript";
import * as path from "node:path"

import * as ib from "./llvm/instruction_buffer.js"
import * as cg_utils from "./code_gen_utils"

let program: ts.Program;

//TODO: find a more suitable place for this list.
export let importedFunctions: string[];

//TODO: merge with importedFunctions (maybe wrap with an imports class?) and make more general
export let importedFunctionsNodes: ts.PropertyAccessExpression[];

export let checker: ts.TypeChecker;
export let printer: ts.Printer;
export let iBuff: ib.InstructionBuffer;
export let symbolTable: Map<string, number>;
export let irOutputPath: string;
export let outputDirPath: string;
export let localInterfaces: string[];

export function InitManager(sourceFiles: string[], outputDir: string): void {
	const options: ts.CompilerOptions = {
	};
	program = ts.createProgram( sourceFiles , options); //TODO: add compiler options handling
	//TODO: check if the programs syntax\semantics are ok

	checker = program.getTypeChecker();
	printer = ts.createPrinter();
	iBuff = new ib.InstructionBuffer();
	symbolTable = new Map<string, number>();
	outputDirPath = outputDir;

	//TODO: get name from cmd args
	irOutputPath = path.join(outputDir, `module.llvm`);

	importedFunctions = [];
	importedFunctionsNodes = [];

	localInterfaces = cg_utils.getAllInterfaceNames(getSourceFiles());
}

export function getSourceFiles(): ts.SourceFile[] {
	return program.getSourceFiles().filter(sf => !sf.isDeclarationFile);
}

export function getWasmFileName(): string {
	//TODO: get from cmd args
	return `module.wasm`;
}

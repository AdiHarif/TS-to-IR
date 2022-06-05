
import * as ts from "typescript";

import * as ib from "../instruction_buffer.js"

export let sourceFiles: readonly ts.SourceFile[] = [];
export let checker: ts.TypeChecker;
export let iBuff: ib.InstructionBuffer;
export let regMap: Map<string, number>;


export function InitManager(fileNames: string[]): void {
	const options: ts.CompilerOptions = {
	};
	const program = ts.createProgram(fileNames, options); //TODO: add compiler options handling
	sourceFiles = program.getSourceFiles();
	sourceFiles = sourceFiles.filter(sf => !sf.isDeclarationFile);
	//TODO: check if the programs syntax\semantics are ok


	checker = program.getTypeChecker();
	iBuff = new ib.InstructionBuffer();
	regMap = new Map<string, number>();
}
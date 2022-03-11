
import { assert } from "console";
import { EWOULDBLOCK } from "constants";
import { emit } from "process";
import * as ts from "typescript";
import * as ib from "./instruction_buffer.js";

interface BackPatchContext {
	concat(ctx: BackPatchContext): void;
}

class StatementsBackPatchContext implements BackPatchContext {
	public nextList: number[] = [];

	constructor(nextList: number[]) {
		this.nextList = nextList;
	}

	concat(ctx: StatementsBackPatchContext): void {
		this.nextList.concat(ctx.nextList);
	}

	isEmpty(): boolean {
		return this.nextList.length == 0;
	}
}

// class ExpressionBackPatchContext implements BackPatchContext {
// 	public trueList: number[] = [];
// 	public falseList: number[] = [];

// 	constructor(trueList: number[], falseList: number[]) {
// 		this.trueList = trueList;
// 		this.falseList = falseList;
// 	}

// 	concat(ctx: ExpressionBackPatchContext): void {
// 		this.trueList.concat(ctx.trueList);
// 		this.falseList.concat(ctx.falseList);
// 	}
// }

export function compileProgram(fileNames: string[]): void {
	const options: ts.CompilerOptions = {
	};
	const program = ts.createProgram(fileNames, options); //TODO: add compiler options handling
	let sourceFiles: ts.SourceFile[] = getSourceFiles();
	//TODO: check if the programs syntax\semantics are ok


	const checker = program.getTypeChecker();
	let iBuff = new ib.InstructionBuffer();
	sourceFiles.forEach(compileNode);
	const outCode = iBuff.dumpBuffer();

	function compileNode(node: ts.Node): BackPatchContext {
		switch (node.kind) {
			case ts.SyntaxKind.Block:
			case ts.SyntaxKind.SourceFile:
				let bpCtx = new StatementsBackPatchContext([]);
				(node as ts.BlockLike).statements.forEach(statement => {
					if (!bpCtx.isEmpty()){
						const label = iBuff.emitNewLabel();
						iBuff.backPatch(bpCtx.nextList, label)
					}
					bpCtx = compileNode(statement)! as StatementsBackPatchContext;
				});
				return bpCtx;

			case ts.SyntaxKind.FunctionDeclaration:
				const fun = node as ts.FunctionDeclaration;
				emitFunctionDeclaration(fun);
				compileNode(fun.body!);
				return new StatementsBackPatchContext([]);

			// case ts.SyntaxKind.IfStatement:
			// 	const ifStat = node as ts.IfStatement;
			// 	const expBpCtx = compileNode(ifStat.expression) as ExpressionBackPatchContext; //TODO: handle cases where the expression is an identifier/constant value
			// 	const trueLabel = iBuff.emitNewLabel();
			// 	iBuff.backPatch(expBpCtx.trueList, trueLabel);
			// 	const thenBpCtx = compileNode(ifStat.thenStatement) as StatementsBackPatchContext;
			// 	if (ifStat.elseStatement){
			// 		const falseLabel =iBuff.emitNewLabel();
			// 		iBuff.backPatch(expBpCtx.falseList, falseLabel);
			// 		const elseBpCtx = compileNode(ifStat.elseStatement) as StatementsBackPatchContext;
			// 		return new StatementsBackPatchContext(elseBpCtx.nextList.concat(thenBpCtx.nextList));
			// 	}
			// 	else { //no else statement
			// 		return new StatementsBackPatchContext(expBpCtx.falseList.concat(thenBpCtx.nextList));
			// 	}

			default:
				throw new Error("unsupported node kind: " + ts.SyntaxKind[node.kind]);
		}
	}

	function getSourceFiles(): ts.SourceFile[] {
		const sourceFiles = program.getSourceFiles();
		return sourceFiles.filter(sf => !sf.isDeclarationFile);
	}

	function getSymbolTypeFlags(symbol: ts.Symbol): ts.TypeFlags {
		return checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!).getFlags();
	}

	function emitFunctionDeclaration(fun: ts.FunctionDeclaration): void {
		const signature = checker.getSignatureFromDeclaration(fun)!;
		const retType = checker.getReturnTypeOfSignature(signature).flags;
		let paramTypes: ts.TypeFlags[] = [];
		signature.parameters.forEach(paramSymbol => paramTypes.push(getSymbolTypeFlags(paramSymbol)));
		const id = fun.name!.getText();
		iBuff.emit(new ib.FunctionDeclarationInstruction(id, retType, paramTypes));
	}
}

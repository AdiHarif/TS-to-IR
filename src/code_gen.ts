

import * as ts from "typescript";
import * as ib from "./instruction_buffer.js";

class StatementCodeGenContext {
	public nextList: number[] = [];

	constructor(nextList: number[]) {
		this.nextList = nextList;
	}

	isEmpty(): boolean {
		return this.nextList.length == 0;
	}
}

interface ExpressionCodeGenContext  {
	isValueSaved: boolean;
	typeFlags: ts.TypeFlags;
}

class SavedExpressionCodeGenContext implements ExpressionCodeGenContext {
	readonly isValueSaved: boolean = true;

	public typeFlags: ts.TypeFlags;
	public registerIndex: number = -1;

	constructor(registerIndex: number, typeFlags: ts.TypeFlags) {
		this.registerIndex = registerIndex;
		this.typeFlags = typeFlags;

	}
}

class UnsavedExpressionCodeGen implements ExpressionCodeGenContext {
	readonly isValueSaved: boolean = false;
	readonly typeFlags: ts.TypeFlags = ts.TypeFlags.Boolean;

	public trueList: number[] = [];
	public falseList: number[] = [];

	constructor(trueList: number[], falseList: number[]) {
		this.trueList = trueList;
		this.falseList = falseList;
	}

}

type CodeGenContext = StatementCodeGenContext | ExpressionCodeGenContext;

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

	function compileNode(node: ts.Node): CodeGenContext {
		switch (node.kind) {
			// case ts.SyntaxKind.ExpressionStatement:
			// 	compileNode((node as ts.ExpressionStatement).expression);
			// 	return new StatementCodeGenContext([]);
			// case ts.SyntaxKind.BinaryExpression:
			// 	console.log("node text: " + node.getText() + ", type: " + checker.getTypeAtLocation(node).flags);
			// 	node.forEachChild(compileNode);
			// 	return new StatementCodeGenContext([]);

			case ts.SyntaxKind.SourceFile:
				//TODO: implement adding main function with script statements (outside functions)
			case ts.SyntaxKind.Block:
				let bpCtx = new StatementCodeGenContext([]);
				(node as ts.BlockLike).statements.forEach(statement => {
					if (!bpCtx.isEmpty()){
						const label = iBuff.emitNewLabel();
						iBuff.backPatch(bpCtx.nextList, label)
					}
					bpCtx = compileNode(statement) as StatementCodeGenContext;
				});
				return bpCtx;

			case ts.SyntaxKind.FunctionDeclaration:
				const fun = node as ts.FunctionDeclaration;
				emitFunctionDeclaration(fun);
				compileNode(fun.body!);
				return new StatementCodeGenContext([]);

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
				//throw new Error("unsupported node kind: " + ts.SyntaxKind[node.kind]);
				console.log("unsupported node kind: " + ts.SyntaxKind[node.kind]);
				node.forEachChild(compileNode);
				return new StatementCodeGenContext([]);
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


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
}

class SavedExpressionCodeGenContext implements ExpressionCodeGenContext {
	readonly isValueSaved: boolean = true;

	public reg: number;

	constructor(reg: number) {
		this.reg = reg;
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
	let sourceFiles = getSourceFiles();
	//TODO: check if the programs syntax\semantics are ok


	const checker = program.getTypeChecker();
	let iBuff = new ib.InstructionBuffer();
	let regMap = new Map<string, number>();

	sourceFiles.forEach(compileNode);

	const outCode = iBuff.dumpBuffer();
	console.log(outCode);

	function compileNode(node: ts.Node): CodeGenContext {
		switch (node.kind) {
			case ts.SyntaxKind.Identifier:
				const id = node as ts.Identifier;
				const reg = regMap.get(id.text);
				return new SavedExpressionCodeGenContext(reg!);

			case ts.SyntaxKind.ParenthesizedExpression:
				return compileNode((node as ts.ParenthesizedExpression).expression);

			case ts.SyntaxKind.ExpressionStatement:
				compileNode((node as ts.ExpressionStatement).expression); //TODO: make sure there is nothing to do with the return value
				return new StatementCodeGenContext([]);

			case ts.SyntaxKind.BinaryExpression:
				const typeFlags = checker.getTypeAtLocation(node).flags;
				if (typeFlags & ts.TypeFlags.Number){
					return emitNumericBinaryExpression(node as ts.BinaryExpression);
				}
				else {
					console.log("unsupported expression type flags: " + typeFlags);
				}
				node.forEachChild(compileNode);
				return new StatementCodeGenContext([]);

			case ts.SyntaxKind.VariableStatement:
				(node as ts.VariableStatement).declarationList.declarations.forEach(compileNode);
				return new StatementCodeGenContext([]);

			case ts.SyntaxKind.VariableDeclaration:
				let varDec = node as ts.VariableDeclaration;
				if (varDec.initializer) {
					let expCtx = compileNode(varDec.initializer) as ExpressionCodeGenContext;
					if (expCtx.isValueSaved) {
						regMap.set(varDec.name.getText(), (expCtx as SavedExpressionCodeGenContext).reg);
					}
					else {
						//TODO: save bool value if necessary
					}
				}
				return new StatementCodeGenContext([]);

			case ts.SyntaxKind.ReturnStatement:
				const retStat = node as ts.ReturnStatement;
				let retInst: ib.ReturnInstruction;
				if (retStat.expression) {
					const expCtx = compileNode(retStat.expression) as ExpressionCodeGenContext;
					let retReg: number;
					if (!expCtx.isValueSaved) {
						retReg = 0;//TODO: save exp value
					}
					else {
						retReg = (expCtx as SavedExpressionCodeGenContext).reg;
					}
					let retType = checker.getTypeAtLocation(retStat.expression).flags;
					retInst = new ib.ReturnInstruction(retType, retReg);
				}
				else {
					retInst = new ib.ReturnInstruction(ts.TypeFlags.Void);
				}
				iBuff.emit(retInst);
				return new StatementCodeGenContext([]);

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
		for (let i = 0; i < signature.parameters.length; i++) {
			const paramSymbol = signature.parameters[i];
			regMap.set(paramSymbol.getName(), -(i + 1));
			paramTypes.push(getSymbolTypeFlags(paramSymbol));
		}
		const id = fun.name!.getText();
		iBuff.emit(new ib.FunctionDeclarationInstruction(id, retType, paramTypes));
	}

	function emitNumericBinaryExpression(exp: ts.BinaryExpression): SavedExpressionCodeGenContext {
		const leftCtx = compileNode(exp.left) as SavedExpressionCodeGenContext;
		const rightCtx = compileNode(exp.right) as SavedExpressionCodeGenContext;
		const resReg = iBuff.getNewReg();
		iBuff.emit(new ib.NumericInstruction(resReg, leftCtx.reg, rightCtx.reg, exp.operatorToken.kind));
		return new SavedExpressionCodeGenContext(resReg);
	}
}

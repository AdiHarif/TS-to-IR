
import { assert } from "console";
import * as ts from "typescript";
import * as ib from "./instruction_buffer.js";

class StatementCodeGenContext {
	public nextList: ib.BpEntry[] = [];

	constructor(nextList: ib.BpEntry[]) {
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

class UnsavedExpressionCodeGenContext implements ExpressionCodeGenContext {
	readonly isValueSaved: boolean = false;
	readonly typeFlags: ts.TypeFlags = ts.TypeFlags.Boolean;

	public trueList: ib.BpEntry[] = [];
	public falseList: ib.BpEntry[] = [];

	constructor(trueList: ib.BpEntry[], falseList: ib.BpEntry[]) {
		this.trueList = trueList;
		this.falseList = falseList;
	}

}

type CodeGenContext = StatementCodeGenContext | ExpressionCodeGenContext;

const libFunctions = [ //TODO: add printf and remove handling console.log
	"scanf"
];

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
			case ts.SyntaxKind.ClassDeclaration:
				return emitClass(node as ts.ClassDeclaration);

			case ts.SyntaxKind.ImportDeclaration:
				return new StatementCodeGenContext([]);

			case ts.SyntaxKind.Identifier:
				const id = node as ts.Identifier;
				const reg = regMap.get(id.text);
				return new SavedExpressionCodeGenContext(reg!);

			case ts.SyntaxKind.NumericLiteral:
				// ? TODO: return the constant value as context instead of saving it to register
				const val = parseInt(node.getText()); //TODO: support bases other than decimal
				return emitSaveNumericValue(val);


			case ts.SyntaxKind.ParenthesizedExpression:
				return compileNode((node as ts.ParenthesizedExpression).expression);

			case ts.SyntaxKind.ExpressionStatement:
				compileNode((node as ts.ExpressionStatement).expression); //TODO: make sure there is nothing to do with the return value
				return new StatementCodeGenContext([]);

			case ts.SyntaxKind.BinaryExpression:
				const typeFlags = checker.getTypeAtLocation(node).flags;
				if (typeFlags & ts.TypeFlags.Number) {
					return emitNumericBinaryExpression(node as ts.BinaryExpression);
				}
				if (typeFlags & ts.TypeFlags.Boolean) {
					return emitBooleanBinaryExpression(node as ts.BinaryExpression)
				}
				else {
					console.log("unsupported expression type flags: " + typeFlags);
				}
				node.forEachChild(compileNode);
				return new StatementCodeGenContext([]);

			case ts.SyntaxKind.CallExpression:
				let callExp = node as ts.CallExpression;
				let funcName = "";
				let retType = ts.TypeFlags.Unknown;
				//TODO: remove handling console.log and replace with printf
				if (callExp.expression.kind == ts.SyntaxKind.Identifier) {
					funcName = (callExp.expression as ts.Identifier).text;
					retType = checker.getTypeAtLocation(callExp).flags;
				}
				else if (callExp.expression.kind == ts.SyntaxKind.PropertyAccessExpression &&
					 callExp.expression.getText() == "console.log") {

					retType = ts.TypeFlags.Void;
					//TODO: handle multiple arguments and other argument types
					let argType = checker.getTypeAtLocation(callExp.arguments[0]).flags;
					if (argType & ts.TypeFlags.String) {
						funcName = "prints";
					}
					if (argType & ts.TypeFlags.Number) {
						funcName = "printd";
					}
				}
				else {
					console.log("unsupported PropertyAccessExpression: " + callExp.expression.getText());
				}

				if (libFunctions.indexOf(funcName) > -1) {
					return emitLibFuncitonCall(callExp);
				}

				let paramRegs: ib.TypedReg[] = [];
				callExp.arguments.forEach(exp => {
					const expCtx = compileNode(exp) as SavedExpressionCodeGenContext; //TODO: handle unsaved expressions
					let argType = checker.getTypeAtLocation(exp).flags;
					if (argType == ts.TypeFlags.Any) {
						argType = checker.getContextualType(exp)!.flags;
					}
					paramRegs.push({
						reg: expCtx.reg, typeFlags: argType
					});
				});

				return emitFunctionCall(retType, funcName, paramRegs);

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
				return emitBlock(node as ts.Block);

			case ts.SyntaxKind.FunctionDeclaration:
				const fun = node as ts.FunctionDeclaration;
				emitFunctionDeclaration(fun);
				//TODO: replace compileNode with compileBlock and handle return value
				compileNode(fun.body!);
				//TODO: make this if more readable
				if ( checker.getReturnTypeOfSignature(checker.getSignatureFromDeclaration(fun)!).flags & ts.TypeFlags.Void) {
					iBuff.emit(new ib.ReturnInstruction(ts.TypeFlags.Void));
				}

				iBuff.emit(new ib.FunctionEndInstruction());
				return new StatementCodeGenContext([]);

			case ts.SyntaxKind.IfStatement:
				const ifStat = node as ts.IfStatement;
				const expCgCtx = compileNode(ifStat.expression) as UnsavedExpressionCodeGenContext; //TODO: handle cases where the expression is an identifier/constant value (saved value in general)
				const trueLabel = iBuff.emitNewLabel();

				iBuff.backPatch((expCgCtx as UnsavedExpressionCodeGenContext).trueList, trueLabel);
				const thenBpCtx = compileNode(ifStat.thenStatement) as StatementCodeGenContext;

				if (ifStat.elseStatement){
					const falseLabel = iBuff.emitNewLabel();
					iBuff.backPatch(expCgCtx.falseList, falseLabel);
					const elseBpCtx = compileNode(ifStat.elseStatement) as StatementCodeGenContext;
					return new StatementCodeGenContext(elseBpCtx.nextList.concat(thenBpCtx.nextList));
				}
				else { //no else statement
					return new StatementCodeGenContext(expCgCtx.falseList.concat(thenBpCtx.nextList));
				}

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

	function getSymbolTypeFlags(symbol: ts.Symbol): ts.Type {
		return checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!);
	}

	function emitFunctionDeclaration(fun: ts.FunctionLikeDeclaration, cls?: ts.Type): void {
		const signature = checker.getSignatureFromDeclaration(fun)!;
		let paramTypes: ts.Type[] = [];
		regMap.clear();
		for (let i = 0; i < signature.parameters.length; i++) {
			const paramSymbol = signature.parameters[i];
			regMap.set(paramSymbol.getName(), -(i + 1)); //TODO: find an elegant representations of function arguments
			paramTypes.push(getSymbolTypeFlags(paramSymbol));
		}
		let id: string;
		let retType: ts.Type | null;
		if (fun.kind == ts.SyntaxKind.Constructor) {
			retType = null;
			id = 'constructor';
		}
		else {
			retType = checker.getReturnTypeOfSignature(signature);
			id = fun.name!.getText();
		}

		if (cls) {
			id = cls.symbol.getName() + '.' + id;
			paramTypes.push(cls);
			regMap.set('this', -(signature.parameters.length + 1));
		}
		iBuff.emit(new ib.FunctionDeclarationInstruction(id, retType, paramTypes));
	}

	function emitNumericBinaryExpression(exp: ts.BinaryExpression): SavedExpressionCodeGenContext {
		const leftCtx = compileNode(exp.left) as SavedExpressionCodeGenContext;
		const rightCtx = compileNode(exp.right) as SavedExpressionCodeGenContext;
		const resReg = iBuff.getNewReg();
		iBuff.emit(new ib.NumericOpInstruction(resReg, leftCtx.reg, rightCtx.reg, exp.operatorToken.kind));
		return new SavedExpressionCodeGenContext(resReg);
	}

	function emitBooleanBinaryExpression(exp: ts.BinaryExpression): UnsavedExpressionCodeGenContext {
		const leftCtx = compileNode(exp.left) as SavedExpressionCodeGenContext;
		const rightCtx = compileNode(exp.right) as SavedExpressionCodeGenContext;
		switch (exp.operatorToken.kind) {
			case ts.SyntaxKind.LessThanToken:
			case ts.SyntaxKind.LessThanEqualsToken:
			case ts.SyntaxKind.GreaterThanToken:
			case ts.SyntaxKind.GreaterThanEqualsToken:
			case ts.SyntaxKind.EqualsEqualsToken:
			case ts.SyntaxKind.ExclamationEqualsToken:
				let resReg = iBuff.getNewReg();
				iBuff.emit(new ib.EqualityOpInstruction(resReg, leftCtx.reg, rightCtx.reg, exp.operatorToken.kind));
				let brInst = iBuff.emit(new ib.ConditionalBranchInstruction(resReg));
				let trueEntry: ib.BpEntry = { instruction: brInst, index: 0 };
				let falseEntry: ib.BpEntry = { instruction: brInst, index: 1 };
				return new UnsavedExpressionCodeGenContext([trueEntry], [falseEntry]);
				break;
			default:
				throw new Error("unsupported binary op: " + ts.SyntaxKind[exp.operatorToken.kind]);
		}

	}

	function emitFunctionCall(retType: ts.TypeFlags, name: string, paramRegs: ib.TypedReg[]): SavedExpressionCodeGenContext {
		//TODO: remove allocating new reg for void functions
		const retReg: ib.TypedReg = {
			reg: iBuff.getNewReg(),
			typeFlags: retType
		};
		iBuff.emit(new ib.FunctionCallInstruction(retReg, name, paramRegs));
		return new SavedExpressionCodeGenContext(retReg.reg);
	}

	function emitLibFuncitonCall(funCall: ts.CallExpression): SavedExpressionCodeGenContext {
		const funName = (funCall.expression as ts.Identifier).getText();
		const args = funCall.arguments;
		let llvmFunName = "";
		let llvmRetType = ts.TypeFlags.Void;
		let llvmArgs: ib.TypedReg[] = [];
		switch (funName){
			case "scanf":
				assert(args.length == 1);
				const format = args[0].getText();
				switch (format) {
					case '\"%f\"':
					case '\"%lf\"':
					case '\"%d\"':
						llvmFunName = "scand";
						llvmRetType = ts.TypeFlags.Number
						break;
					default:
						throw new Error("unsupported scanf format: " + format);
				}
				break;
			default:
				throw new Error("")
		}

		//TODO: remove allocating new reg for void functions
		const llvmRetReg: ib.TypedReg = {
			reg: iBuff.getNewReg(),
			typeFlags: llvmRetType
		};
		iBuff.emit(new ib.FunctionCallInstruction(llvmRetReg, llvmFunName, llvmArgs));
		return new SavedExpressionCodeGenContext(llvmRetReg.reg);
	}

	function emitSaveNumericValue(val: number): SavedExpressionCodeGenContext {
		const reg = iBuff.getNewReg();
		iBuff.emit(new ib.NumericAssignmentInstruction(reg, val));
		return new SavedExpressionCodeGenContext(reg);
	}

	function emitClass(cl: ts.ClassDeclaration): StatementCodeGenContext {
		/*
		 assumptions:
		 * classes must be named
		 * class members contain only properties (fields), non-static methods and a single constructor
		 */
		let symbol: ts.Symbol = checker.getSymbolAtLocation(cl.name!)!;
		let type: ts.Type = checker.getDeclaredTypeOfSymbol(symbol);
		let properties: ts.Symbol[] = checker.getPropertiesOfType(type).filter(sym => sym.flags == ts.SymbolFlags.Property);
		let propTypes: ts.TypeFlags[] = properties.map(sym => checker.getTypeOfSymbolAtLocation(sym, cl).flags);
		iBuff.emitStructDefinition(new ib.StructDefinitionInstruction(symbol.name, propTypes));
		cl.forEachChild(child => {
			switch (child.kind) {
				case ts.SyntaxKind.PropertyDeclaration:
					break;
				case ts.SyntaxKind.Constructor:
				case ts.SyntaxKind.MethodDeclaration:
					emitClassMethod(child as ts.FunctionLikeDeclaration, type);
					break;
			}
		})
		return new StatementCodeGenContext([]);
	}

	function emitClassMethod(method: ts.FunctionLikeDeclaration, classType: ts.Type): void {
		/*
		 assumptions:
		 * input declaration must be either a ctor or a class method
		 */
		emitFunctionDeclaration(method, classType);
		let bpCtx = emitBlock(method.body as ts.FunctionBody);
		if (!bpCtx.isEmpty()) {
			let label: number = iBuff.emitNewLabel();
			iBuff.backPatch(bpCtx.nextList, label);
		}
		let retType: ts.Type = checker.getSignatureFromDeclaration(method)!.getReturnType();
		if (retType.getFlags() & ts.TypeFlags.Void) {
			iBuff.emit(new ib.ReturnInstruction(ts.TypeFlags.Void));
		}
		iBuff.emit(new ib.FunctionEndInstruction());
	}

	function emitBlock(block: ts.BlockLike): StatementCodeGenContext {
		let bpCtx = new StatementCodeGenContext([]);
		block.statements.forEach(statement => {
			if (!bpCtx.isEmpty()){
				const label = iBuff.emitNewLabel();
				iBuff.backPatch(bpCtx.nextList, label)
			}
			bpCtx = compileNode(statement) as StatementCodeGenContext;
		});
		return bpCtx;
	}
}

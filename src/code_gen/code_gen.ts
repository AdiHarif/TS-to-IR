
import { assert } from "console";
import * as ts from "typescript";
import { writeFileSync } from "fs"

import * as cgm from "./manager.js"
import * as inst from "../ir/instructions";
import { emitObjectAllocationFunctionDefinition, emitObjectFieldGetter, emitObjectFieldSetter } from "./templates.js"

class StatementCodeGenContext {
	public nextList: inst.BpEntry[] = [];

	constructor(nextList: inst.BpEntry[]) {
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

	public trueList: inst.BpEntry[] = [];
	public falseList: inst.BpEntry[] = [];

	constructor(trueList: inst.BpEntry[], falseList: inst.BpEntry[]) {
		this.trueList = trueList;
		this.falseList = falseList;
	}

}

type CodeGenContext = StatementCodeGenContext | ExpressionCodeGenContext;

const libFunctions = [ //TODO: add printf and remove handling console.log
	"scanf"
];

export function compileProgram(): void {

	cgm.sourceFiles.forEach(compileNode);

	const outCode = cgm.iBuff.dumpBuffer();
	writeFileSync(cgm.outputFilePath, outCode);

	function compileNode(node: ts.Node): CodeGenContext {
		switch (node.kind) {
			case ts.SyntaxKind.ClassDeclaration:
				return emitClass(node as ts.ClassDeclaration);

			case ts.SyntaxKind.ImportDeclaration:
				return new StatementCodeGenContext([]);

			case ts.SyntaxKind.Identifier:
				const id = node as ts.Identifier;
				const reg = cgm.regMap.get(id.text);
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
				const typeFlags = cgm.checker.getTypeAtLocation(node).flags;
				if ((node as ts.BinaryExpression).operatorToken.kind == ts.SyntaxKind.EqualsToken) {
					return emitAssignment(node as ts.BinaryExpression);
				}
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

				let paramRegs: inst.TypedReg[] = [];
				callExp.arguments.forEach(exp => {
					const expCtx = compileNode(exp) as SavedExpressionCodeGenContext; //TODO: handle unsaved expressions
					let argType = cgm.checker.getTypeAtLocation(exp);
					if (argType.getFlags() == ts.TypeFlags.Any) {
						argType = cgm.checker.getContextualType(exp)!;
					}
					paramRegs.push({
						reg: expCtx.reg, type: argType
					});
				});

				let retType: ts.Type | null = cgm.checker.getTypeAtLocation(callExp);
				//TODO: remove handling console.log and replace with printf
				if (callExp.expression.kind == ts.SyntaxKind.Identifier) {
					funcName = (callExp.expression as ts.Identifier).text;
				}
				else if (callExp.expression.kind == ts.SyntaxKind.PropertyAccessExpression &&
					 callExp.expression.getText() == "console.log") {

					retType = null;
					//TODO: handle multiple arguments and other argument types
					let argType = cgm.checker.getTypeAtLocation(callExp.arguments[0]).flags;
					if (argType & ts.TypeFlags.String) {
						funcName = "prints";
					}
					if (argType & ts.TypeFlags.Number) {
						funcName = "printd";
					}
				}
				else {
					if ((callExp.expression as ts.PropertyAccessExpression).expression.kind == ts.SyntaxKind.ThisKeyword) {
						let objType: ts.Type = cgm.checker.getTypeAtLocation((callExp.expression as ts.PropertyAccessExpression).expression);
						funcName =  objType.getSymbol()!.getName();
						paramRegs.push({ reg: cgm.regMap.get('this')!, type: objType})
					}
					else {
						funcName =  ((callExp.expression as ts.PropertyAccessExpression).expression as ts.Identifier).getText();
					}
					funcName += '_' + (callExp.expression as ts.PropertyAccessExpression).name.getText();
				}

				if (libFunctions.indexOf(funcName) > -1) {
					return emitLibFuncitonCall(callExp);
				}

				return emitFunctionCall(retType, funcName, paramRegs);

			case ts.SyntaxKind.VariableStatement:
				(node as ts.VariableStatement).declarationList.declarations.forEach(compileNode);
				return new StatementCodeGenContext([]);

			case ts.SyntaxKind.VariableDeclaration:
				let varDec = node as ts.VariableDeclaration;
				if (varDec.initializer) {
					let expCtx = compileNode(varDec.initializer) as ExpressionCodeGenContext;
					if (expCtx.isValueSaved) {
						cgm.regMap.set(varDec.name.getText(), (expCtx as SavedExpressionCodeGenContext).reg);
					}
					else {
						//TODO: save bool value if necessary
					}
				}
				return new StatementCodeGenContext([]);

			case ts.SyntaxKind.ReturnStatement:
				const retStat = node as ts.ReturnStatement;
				let retInst: inst.ReturnInstruction;
				if (retStat.expression) {
					const expCtx = compileNode(retStat.expression) as ExpressionCodeGenContext;
					let retReg: number;
					if (!expCtx.isValueSaved) {
						retReg = 0;//TODO: save exp value
					}
					else {
						retReg = (expCtx as SavedExpressionCodeGenContext).reg;
					}
					let retType = cgm.checker.getTypeAtLocation(retStat.expression);
					retInst = new inst.ReturnInstruction(retType, retReg);
				}
				else {
					retInst = new inst.ReturnInstruction(null);
				}
				cgm.iBuff.emit(retInst);
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
				if ( cgm.checker.getReturnTypeOfSignature(cgm.checker.getSignatureFromDeclaration(fun)!).flags & ts.TypeFlags.Void) {
					cgm.iBuff.emit(new inst.ReturnInstruction(null));
				}

				cgm.iBuff.emit(new inst.FunctionEndInstruction());
				return new StatementCodeGenContext([]);

			case ts.SyntaxKind.IfStatement:
				const ifStat = node as ts.IfStatement;
				const expCgCtx = compileNode(ifStat.expression) as UnsavedExpressionCodeGenContext; //TODO: handle cases where the expression is an identifier/constant value (saved value in general)
				const trueLabel = cgm.iBuff.emitNewLabel();

				cgm.iBuff.backPatch((expCgCtx as UnsavedExpressionCodeGenContext).trueList, trueLabel);
				const thenBpCtx = compileNode(ifStat.thenStatement) as StatementCodeGenContext;

				if (ifStat.elseStatement){
					const falseLabel = cgm.iBuff.emitNewLabel();
					cgm.iBuff.backPatch(expCgCtx.falseList, falseLabel);
					const elseBpCtx = compileNode(ifStat.elseStatement) as StatementCodeGenContext;
					return new StatementCodeGenContext(elseBpCtx.nextList.concat(thenBpCtx.nextList));
				}
				else { //no else statement
					return new StatementCodeGenContext(expCgCtx.falseList.concat(thenBpCtx.nextList));
				}

			case ts.SyntaxKind.NewExpression:
				return emitNewExpression(node as ts.NewExpression);

			case ts.SyntaxKind.PropertyAccessExpression:
				return emitLoadProperty(node as ts.PropertyAccessExpression);

			default:
				//throw new Error("unsupported node kind: " + ts.SyntaxKind[node.kind]);
				console.log("unsupported node kind: " + ts.SyntaxKind[node.kind]);
				node.forEachChild(compileNode);
				return new StatementCodeGenContext([]);
		}
	}

	function getSymbolTypeFlags(symbol: ts.Symbol): ts.Type {
		return cgm.checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!);
	}

	function emitFunctionDeclaration(fun: ts.FunctionLikeDeclaration, cls?: ts.Type): void {
		const signature = cgm.checker.getSignatureFromDeclaration(fun)!;
		let paramTypes: ts.Type[] = [];
		cgm.regMap.clear();
		for (let i = 0; i < signature.parameters.length; i++) {
			const paramSymbol = signature.parameters[i];
			cgm.regMap.set(paramSymbol.getName(), -(i + 1)); //TODO: find an elegant representations of function arguments
			paramTypes.push(getSymbolTypeFlags(paramSymbol));
		}
		let id: string;
		let retType: ts.Type | null;
		if (fun.kind == ts.SyntaxKind.Constructor) {
			retType = cls!;
			id = 'constructor';
		}
		else {
			retType = cgm.checker.getReturnTypeOfSignature(signature);
			id = fun.name!.getText();
		}

		if (cls) {
			id = cls.symbol.getName() + '_' + id;
			if (fun.kind != ts.SyntaxKind.Constructor) {
				paramTypes.push(cls);
			}
			cgm.regMap.set('this', -(signature.parameters.length + 1));
		}
		cgm.iBuff.emit(new inst.FunctionDefinitionInstruction(id, retType, paramTypes));
	}

	function emitNumericBinaryExpression(exp: ts.BinaryExpression): SavedExpressionCodeGenContext {
		const leftCtx = compileNode(exp.left) as SavedExpressionCodeGenContext;
		const rightCtx = compileNode(exp.right) as SavedExpressionCodeGenContext;
		const resReg = cgm.iBuff.getNewReg();
		cgm.iBuff.emit(new inst.NumericOpInstruction(resReg, leftCtx.reg, rightCtx.reg, exp.operatorToken.kind));
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
				let resReg = cgm.iBuff.getNewReg();
				cgm.iBuff.emit(new inst.EqualityOpInstruction(resReg, leftCtx.reg, rightCtx.reg, exp.operatorToken.kind));
				let brInst = cgm.iBuff.emit(new inst.ConditionalBranchInstruction(resReg));
				let trueEntry: inst.BpEntry = { instruction: brInst, index: 0 };
				let falseEntry: inst.BpEntry = { instruction: brInst, index: 1 };
				return new UnsavedExpressionCodeGenContext([trueEntry], [falseEntry]);
				break;
			default:
				throw new Error("unsupported binary op: " + ts.SyntaxKind[exp.operatorToken.kind]);
		}

	}

	function emitFunctionCall(retType: ts.Type | null, name: string, paramRegs: inst.TypedReg[]): SavedExpressionCodeGenContext {
		//TODO: remove allocating new reg for void functions
		const retReg: inst.TypedReg = {
			reg: cgm.iBuff.getNewReg(),
			type: retType
		};
		cgm.iBuff.emit(new inst.FunctionCallInstruction(retReg, name, paramRegs));
		return new SavedExpressionCodeGenContext(retReg.reg);
	}

	function emitLibFuncitonCall(funCall: ts.CallExpression): SavedExpressionCodeGenContext {
		const funName = (funCall.expression as ts.Identifier).getText();
		const args = funCall.arguments;
		let llvmFunName = "";
		let llvmRetType = null;
		let llvmArgs: inst.TypedReg[] = [];
		switch (funName){
			case "scanf":
				assert(args.length == 1);
				const format = args[0].getText();
				switch (format) {
					case '\"%f\"':
					case '\"%lf\"':
					case '\"%d\"':
						llvmFunName = "scand";
						llvmRetType = null; //TODO: restore this to be number type
						break;
					default:
						throw new Error("unsupported scanf format: " + format);
				}
				break;
			default:
				throw new Error("")
		}

		//TODO: remove allocating new reg for void functions
		const llvmRetReg: inst.TypedReg = {
			reg: cgm.iBuff.getNewReg(),
			type: llvmRetType
		};
		cgm.iBuff.emit(new inst.FunctionCallInstruction(llvmRetReg, llvmFunName, llvmArgs));
		return new SavedExpressionCodeGenContext(llvmRetReg.reg);
	}

	function emitSaveNumericValue(val: number): SavedExpressionCodeGenContext {
		const reg = cgm.iBuff.getNewReg();
		cgm.iBuff.emit(new inst.NumericAssignmentInstruction(reg, val));
		return new SavedExpressionCodeGenContext(reg);
	}

	function emitClass(cl: ts.ClassDeclaration): StatementCodeGenContext {
		/*
		 assumptions:
		 * classes must be named
		 * class members contain only properties (fields), non-static methods and a single constructor
		 */
		let symbol: ts.Symbol = cgm.checker.getSymbolAtLocation(cl.name!)!;
		let type: ts.Type = cgm.checker.getDeclaredTypeOfSymbol(symbol);
		let properties: ts.Symbol[] = cgm.checker.getPropertiesOfType(type).filter(sym => sym.flags == ts.SymbolFlags.Property);
		let propTypes: ts.Type[] = properties.map(symbol => cgm.checker.getTypeOfSymbolAtLocation(symbol, cl));
		let propTypeFlags: ts.TypeFlags[] = properties.map(sym => cgm.checker.getTypeOfSymbolAtLocation(sym, cl).flags);
		for (let i: number = 0; i < properties.length; i++) {
			emitObjectFieldGetter(type, properties[i], propTypes[i], i);
			emitObjectFieldSetter(type, properties[i], propTypes[i], i);

		}
		cgm.iBuff.emitStructDefinition(new inst.StructDefinitionInstruction(symbol.name, propTypeFlags));
		emitObjectAllocationFunctionDefinition(type);
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
		let ctorRetReg: number = 0;
		if (method.kind == ts.SyntaxKind.Constructor) {
			ctorRetReg = cgm.iBuff.getNewReg();
			cgm.iBuff.emit(new inst.ObjectAllocationInstruction(ctorRetReg, classType));
			cgm.regMap.set('this', ctorRetReg);
		}
		let bpCtx = emitBlock(method.body as ts.FunctionBody);
		if (!bpCtx.isEmpty()) {
			let label: number = cgm.iBuff.emitNewLabel();
			cgm.iBuff.backPatch(bpCtx.nextList, label);
		}
		let retType: ts.Type = cgm.checker.getSignatureFromDeclaration(method)!.getReturnType();
		if (method.kind == ts.SyntaxKind.Constructor) {
			cgm.iBuff.emit(new inst.ReturnInstruction(classType, ctorRetReg));
		}
		else if (retType.getFlags() & ts.TypeFlags.Void) {
			cgm.iBuff.emit(new inst.ReturnInstruction(null));
		}
		cgm.iBuff.emit(new inst.FunctionEndInstruction());
	}

	function emitBlock(block: ts.BlockLike): StatementCodeGenContext {
		let bpCtx = new StatementCodeGenContext([]);
		block.statements.forEach(statement => {
			if (!bpCtx.isEmpty()){
				const label = cgm.iBuff.emitNewLabel();
				cgm.iBuff.backPatch(bpCtx.nextList, label)
			}
			bpCtx = compileNode(statement) as StatementCodeGenContext;
		});
		return bpCtx;
	}

	function emitNewExpression(newExp: ts.NewExpression): SavedExpressionCodeGenContext {
		let objType: ts.Type = cgm.checker.getDeclaredTypeOfSymbol(cgm.checker.getSymbolAtLocation(newExp.expression as ts.Identifier)!);
		let paramRegs: inst.TypedReg[] = [];
		//TODO: wrap this part with 'emitArguments' or something similar and merge with compileNode CallExpression case
		newExp.arguments?.forEach(exp => {
			const expCtx = compileNode(exp) as SavedExpressionCodeGenContext; //TODO: handle unsaved expressions
			let argType = cgm.checker.getTypeAtLocation(exp);
			if (argType.getFlags() == ts.TypeFlags.Any) {
				argType = cgm.checker.getContextualType(exp)!;
			}
			paramRegs.push({
				reg: expCtx.reg, type: argType
			});
		});
		let funcName: string = objType.getSymbol()!.getName() + '_constructor'
		return emitFunctionCall(objType, funcName, paramRegs);
	}

	function emitAssignment(exp: ts.BinaryExpression): SavedExpressionCodeGenContext {
		let rightCgCtx = compileNode(exp.right) as SavedExpressionCodeGenContext;
		if (exp.left.kind == ts.SyntaxKind.Identifier) {
			cgm.regMap.set((exp.left as ts.Identifier).getText(), rightCgCtx.reg);
		}
		else {
			assert(exp.left.kind == ts.SyntaxKind.PropertyAccessExpression);
			//TODO: add assertion of the property access being a property and not function
			let leftCgCtx: SavedExpressionCodeGenContext = emitGetPropertyAddress(exp.left as ts.PropertyAccessExpression);
			cgm.iBuff.emit(new inst.StoreInstruction(leftCgCtx.reg, rightCgCtx.reg, cgm.checker.getTypeAtLocation(exp.right)));
		}
		return rightCgCtx;
	}

	function emitGetPropertyAddress(exp: ts.PropertyAccessExpression): SavedExpressionCodeGenContext {
		let ptrReg: number = cgm.iBuff.getNewReg();
		let objReg: number;
		let objType: ts.Type = cgm.checker.getTypeAtLocation(exp.expression);
		let objPropNames = cgm.checker.getPropertiesOfType(objType).filter(sym => sym.flags == ts.SymbolFlags.Property).map(sym => sym.getName());
		let propIndex: number = objPropNames.indexOf(exp.name.getText());
		if (exp.expression.kind == ts.SyntaxKind.ThisKeyword) {
			objReg = cgm.regMap.get('this')!;
		}
		else {
			objReg = cgm.regMap.get((exp.expression as ts.Identifier).getText())!;
		}
		cgm.iBuff.emit(new inst.GetElementInstruction(ptrReg, objReg, objType, propIndex))
		return new SavedExpressionCodeGenContext(ptrReg);
	}

	function emitLoadProperty(exp: ts.PropertyAccessExpression): SavedExpressionCodeGenContext {
		let addressCgCtx = emitGetPropertyAddress(exp);
		let resReg = cgm.iBuff.getNewReg();
		let valType: ts.Type = cgm.checker.getTypeAtLocation(exp);
		cgm.iBuff.emit(new inst.LoadInstruction(addressCgCtx.reg, resReg, valType))
		return new SavedExpressionCodeGenContext(resReg);
	}
}

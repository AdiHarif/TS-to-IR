
import * as ts from "typescript"

import * as cgm from "./manager.js"
import * as inst from "./llvm/instructions"
import * as cg_utils from "./code_gen_utils"
import { emitFunctionCall, emitBinaryBooleanOperation, emitNegationInstruction, emitLoadVariable, emitPostfixIncrement, emitGetPropertyAddress } from "./llvm/emit"
import { assert } from "console"


export enum ExpressionContextKind {
	Empty,
	Value,
	Address,
	Property,
	Function,
	Method,
	ImportedNamespace
};

export interface ExpressionContext {
	kind: ExpressionContextKind,
	reg?: number,
	type?: ts.Type,
	irName?: string,
	isImported?: boolean
}

//TODO: merge with ExpressionSynthesizedContext
export class BooleanExpressionSynthesizedContext {
	static readonly emptyContext = new BooleanExpressionSynthesizedContext([], []);

	constructor(readonly trueList: inst.BackpatchEntry[], readonly falseList: inst.BackpatchEntry[]) {};

	patchTrueList(label: number) {
		this.trueList.forEach(entry => entry.patch(label));
	}

	patchFalseList(label: number) {
		this.falseList.forEach(entry => entry.patch(label));
	}
}

export function expressionContextToValueReg(context: ExpressionContext, type: ts.Type): number {
	if (context.kind == ExpressionContextKind.Value) {
		return context.reg!;
	}
	else if (context.kind == ExpressionContextKind.Address) {
		return emitLoadVariable(context.reg!, type);
	}
	else {
		throw new Error(`unsupported ExpressionContexKind: ${ExpressionContextKind[context.kind]}`);
	}
}

function assertAddressContext(context: ExpressionContext): void {
	if (context.kind != ExpressionContextKind.Address) {
		throw new Error(`unsupported ExpressionContexKind: ${ExpressionContextKind[context.kind]}`);
	}
}

function assertCallableContext(context: ExpressionContext): void {
	if ((context.kind != ExpressionContextKind.Function) &&
	    (context.kind != ExpressionContextKind.Method)) {
		throw new Error(`unsupported ExpressionContexKind: ${ExpressionContextKind[context.kind]}`);
	}
}

function processArithmeticBinaryExpression(exp: ts.BinaryExpression): ExpressionContext {
	const type = cgm.checker.getTypeAtLocation(exp);
	const leftContext = processExpression(exp.left);
	const leftValueReg = expressionContextToValueReg(leftContext, type);
	const rightContext = processExpression(exp.right);
	const rightValueReg = expressionContextToValueReg(rightContext, type);

	const resReg = cgm.iBuff.getNewReg();
	//TODO: wrap this emit with an emitter function
	cgm.iBuff.emit(new inst.NumericOpInstruction(resReg, leftValueReg, rightValueReg, exp.operatorToken.kind));
	return {
		kind: ExpressionContextKind.Value,
		reg: resReg
	};
}

function processNewExpression(newExp: ts.NewExpression): ExpressionContext {
	let objType: ts.Type = cgm.checker.getDeclaredTypeOfSymbol(cgm.checker.getSymbolAtLocation(newExp.expression as ts.Identifier)!);
	let paramRegs: inst.TypedReg[] = [];
	//TODO: wrap this part with 'emitArguments' or something similar and merge with compileNode CallExpression case
	newExp.arguments?.forEach(exp => {
		let argType = cgm.checker.getTypeAtLocation(exp);
		if (argType.getFlags() == ts.TypeFlags.Any) {
			argType = cgm.checker.getContextualType(exp)!;
		}
		const expressionContext = processExpression(exp);
		const argValueReg = expressionContextToValueReg(expressionContext, argType);
		paramRegs.push({
			reg: argValueReg, type: argType
		});
	});
	let funcName: string = objType.getSymbol()!.getName() + '_constructor'
	return {
		kind: ExpressionContextKind.Value,
		reg: emitFunctionCall(objType, funcName, paramRegs)
	};
}

function processAssignmentExpression(exp: ts.BinaryExpression): ExpressionContext {
	const type = cgm.checker.getTypeAtLocation(exp.right);
	const rightContext = processExpression(exp.right);
	let rightValueReg: number = expressionContextToValueReg(rightContext, type);

	const leftContext = processExpression(exp.left);
	assertAddressContext(leftContext);

	cgm.iBuff.emit(new inst.StoreInstruction(leftContext.reg!, rightValueReg, type));
	return {
		kind: ExpressionContextKind.Value,
		reg: rightValueReg
	};
}

//TODO: merge with processAssignmentExpression
function processCompoundAssignment(exp: ts.BinaryExpression): ExpressionContext {
	const type = cgm.checker.getTypeAtLocation(exp.left);
	const rightContext = processExpression(exp.right);
	const rightValueReg = expressionContextToValueReg(rightContext, type);

	const leftContext = processExpression(exp.left)
	assertAddressContext(leftContext);

	let addressReg: number = leftContext.reg!;
	const oldValueReg = emitLoadVariable(addressReg, type);
	const newValueReg = cgm.iBuff.getNewReg();
	const numericOperator = cg_utils.compoundAssignmentOperatorToNumericOperator(exp.operatorToken.kind as ts.CompoundAssignmentOperator);
	cgm.iBuff.emit(new inst.NumericOpInstruction(newValueReg, oldValueReg, rightValueReg, numericOperator));
	cgm.iBuff.emit(new inst.StoreInstruction(addressReg, newValueReg, type));
	return {
		kind: ExpressionContextKind.Value,
		reg: newValueReg
	};
}

export function processExpression(exp: ts.Expression): ExpressionContext {
	switch (exp.kind) {
		case ts.SyntaxKind.Identifier:
			return processIdentifier(exp as ts.Identifier);
			break;
		case ts.SyntaxKind.NumericLiteral:
			return processNumericLiteral(exp as ts.NumericLiteral);
			break;
		case ts.SyntaxKind.ParenthesizedExpression:
			return processExpression((exp as ts.ParenthesizedExpression).expression);
			break;
		case ts.SyntaxKind.BinaryExpression:
			return processBinaryExpression(exp as ts.BinaryExpression);
			break;
		case ts.SyntaxKind.NewExpression:
			return processNewExpression(exp as ts.NewExpression);
			break;
		case ts.SyntaxKind.PropertyAccessExpression:
			return processPropertyAccessExpression(exp as ts.PropertyAccessExpression);
			break;
		case ts.SyntaxKind.CallExpression:
			return processCallExpression(exp as ts.CallExpression);
			break;
		case ts.SyntaxKind.PrefixUnaryExpression:
			return processPrefixUnaryExpression(exp as ts.PrefixUnaryExpression);
			break;
		case ts.SyntaxKind.PostfixUnaryExpression:
			return processPostfixUnaryExpression(exp as ts.PostfixUnaryExpression);
			break;
		case ts.SyntaxKind.ThisKeyword:
			return processThisExpression(exp as ts.ThisExpression);
		default:
			throw new Error(`unsupported expression kind: ${ts.SyntaxKind[exp.kind]}`);
			break;
	}
}

function processNumericLiteral(numericLiteral: ts.NumericLiteral): ExpressionContext {
	// ? TODO: return the constant value as context instead of saving it to register
	const val = parseInt((numericLiteral as ts.NumericLiteral).getText()); //TODO: support bases other than decimal
	const reg = cgm.iBuff.getNewReg();
	cgm.iBuff.emit(new inst.NumericAssignmentInstruction(reg, val));
	return {
		kind: ExpressionContextKind.Value,
		reg: reg
	};
}

function processBinaryExpression(binaryExpression: ts.BinaryExpression): ExpressionContext {
	const typeFlags = cgm.checker.getTypeAtLocation(binaryExpression).flags;
	if (binaryExpression.operatorToken.kind == ts.SyntaxKind.EqualsToken) {
		return processAssignmentExpression(binaryExpression as ts.BinaryExpression);
	}
	else if (cg_utils.isCompoundAssignmentOperator(binaryExpression.operatorToken.kind)) {
		return processCompoundAssignment(binaryExpression);
	}
	else if (typeFlags & ts.TypeFlags.Number) {
		return processArithmeticBinaryExpression(binaryExpression as ts.BinaryExpression);
	}
	else {
		throw new Error('unsupported expression type');
	}
}

function processCallExpression(callExpression: ts.CallExpression): ExpressionContext {

	let paramRegs: inst.TypedReg[] = [];
	callExpression.arguments.forEach(exp => {
		let argType = cgm.checker.getTypeAtLocation(exp);
		if (argType.getFlags() == ts.TypeFlags.Any) {
			argType = cgm.checker.getContextualType(exp)!;
		}
		const argContext = processExpression(exp);
		const valueReg = expressionContextToValueReg(argContext, argType);
		paramRegs.push({
			reg: valueReg, type: argType
		});
	});

	let retType: ts.Type | null = cgm.checker.getTypeAtLocation(callExpression);
	const expressionContext = processExpression(callExpression.expression);
	assertCallableContext(expressionContext);

	if (expressionContext.kind == ExpressionContextKind.Method) {
		let objType: ts.Type = cgm.checker.getTypeAtLocation((callExpression.expression as ts.PropertyAccessExpression).expression);
		paramRegs.push({ reg: expressionContext.reg!, type: objType})
	}

	const functionName: string = expressionContext.irName!;
	const isImported = expressionContext.isImported;

	if (isImported && (cgm.importedFunctions.indexOf(functionName) == -1) ) {
		cgm.importedFunctions.push(functionName);
		cgm.importedFunctionsNodes.push(callExpression.expression as ts.PropertyAccessExpression);
		let paramTypes: ts.Type[] = paramRegs.map(reg => reg.type as ts.Type);
		cgm.iBuff.emitFunctionDeclaration(new inst.FunctionDeclarationInstruction(functionName, retType, paramTypes))
	}

	const resultReg = emitFunctionCall(retType, functionName, paramRegs);
	return {
		kind: ExpressionContextKind.Value,
		reg: resultReg
	};
}

export function processBooleanBinaryExpression(binaryExpression: ts.BinaryExpression): BooleanExpressionSynthesizedContext {
	const leftContext = processExpression(binaryExpression.left);
	const leftReg = expressionContextToValueReg(leftContext, cg_utils.numberType());
	const rightContext = processExpression(binaryExpression.right);
	const rightReg = expressionContextToValueReg(rightContext, cg_utils.numberType());
	const resReg: number = emitBinaryBooleanOperation(leftReg, rightReg, binaryExpression.operatorToken.kind);
	//TODO: move branch emitting to if statement
	const branchInstruction = new inst.ConditionalBranchInstruction(resReg);
	cgm.iBuff.emit(branchInstruction);
	const trueEntry = new inst.BackpatchEntry(branchInstruction, 0);
	const falseEntry = new inst.BackpatchEntry(branchInstruction, 1);
	return new BooleanExpressionSynthesizedContext([ trueEntry ], [ falseEntry ]);
}

function processPrefixUnaryExpression(prefixUnaryExpression: ts.PrefixUnaryExpression): ExpressionContext {
	switch (prefixUnaryExpression.operator) {
		case ts.SyntaxKind.MinusToken:
			const expContext = processExpression(prefixUnaryExpression.operand);
			const expValueReg = expressionContextToValueReg(expContext, cg_utils.numberType());
			const newValueReg = emitNegationInstruction(expValueReg);
			return {
				kind: ExpressionContextKind.Value,
				reg: newValueReg
			};
			break;
		default:
			throw new Error(`unsupported prefixUnaryOperator: ${ts.SyntaxKind[prefixUnaryExpression.operator]}`);
	}
}

function processPostfixUnaryExpression(postfixExpression: ts.PostfixUnaryExpression): ExpressionContext {
	const operandContext = processExpression(postfixExpression.operand);
	assertAddressContext(operandContext);
	let valueReg: number;
	let contextKind: ExpressionContextKind;
	switch (postfixExpression.operator) {
		case ts.SyntaxKind.PlusPlusToken:
			valueReg = emitPostfixIncrement(operandContext.reg!);
			contextKind = ExpressionContextKind.Value;
			break;
		default:
			throw new Error(`unsupported postfixUnaryOperator: ${ts.SyntaxKind[postfixExpression.operator]}`);
	}
	return {
		kind: contextKind,
		reg: valueReg
	};
}

function processIdentifier(identifier: ts.Identifier): ExpressionContext {
	const symbol: ts.Symbol = cgm.checker.getSymbolAtLocation(identifier)!;
	const type: ts.Type = cgm.checker.getTypeAtLocation(identifier);
	if (symbol.flags & ts.SymbolFlags.Function) {
		return {
			kind: ExpressionContextKind.Function,
			irName: identifier.text
		};
	}
	else if (symbol.flags & ts.SymbolFlags.Method) {
		return {
			kind: ExpressionContextKind.Method,
			irName: identifier.text
		};
	}
	else if (symbol.flags & ts.SymbolFlags.Variable) {
		const kind = cg_utils.isFunctionArgument(identifier) ?  ExpressionContextKind.Value : ExpressionContextKind.Address;
		return {
			kind: kind,
			reg: cgm.symbolTable.get(identifier.text)!,
			type: type
		};
	}
	else if (symbol.flags & ts.SymbolFlags.Property) {
		return {
			kind: ExpressionContextKind.Property,
			irName: identifier.text,
		}
	}
	else {
		return {
			kind: ExpressionContextKind.ImportedNamespace,
			irName: identifier.text
		};
	}
}

function processPropertyAccessExpression(propertyAccessExpression: ts.PropertyAccessExpression): ExpressionContext {
	const expressionContext = processExpression(propertyAccessExpression.expression);
	const nameContext = processIdentifier(propertyAccessExpression.name as ts.Identifier);
	const type = cgm.checker.getTypeAtLocation(propertyAccessExpression);
	switch (nameContext.kind) {
		case ExpressionContextKind.Function:
			assert(expressionContext.kind == ExpressionContextKind.ImportedNamespace);
			return {
				kind: ExpressionContextKind.Function,
				irName: `${expressionContext.irName!}_${nameContext.irName!}`,
				isImported: true
			};
			break;
		case ExpressionContextKind.Method:
			assert(expressionContext.kind == ExpressionContextKind.Address);
			return {
				kind: ExpressionContextKind.Method,
				reg: expressionContext.reg!,
				irName: expressionContext.irName!
			};
			break;
		case ExpressionContextKind.Property:
			const propertyAddressReg = emitGetPropertyAddress(expressionContext.reg!, expressionContext.type!, nameContext.irName!);
			return {
				kind: ExpressionContextKind.Address,
				reg: propertyAddressReg,
				type: type
			};
		default:
			throw new Error(`unsupported ExpressionContextKind: ${ExpressionContextKind[nameContext.kind]}`);

	}
}

function processThisExpression(thisExpression: ts.ThisExpression): ExpressionContext {
	return {
		kind: ExpressionContextKind.Address,
		reg: cgm.symbolTable.get('this')!,
		type: cgm.checker.getTypeAtLocation(thisExpression)!
	};
}
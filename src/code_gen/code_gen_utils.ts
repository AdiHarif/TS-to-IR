
import * as ts from "typescript";

import * as cgm from "./manager.js"

export function getSymbolTypeFlags(symbol: ts.Symbol): ts.Type {
	return cgm.checker.getTypeOfSymbolAtLocation(symbol, symbol.valueDeclaration!);
}

export function isCallExpressionImported(callExpression: ts.CallExpression): boolean {
	return (
		(callExpression.expression.kind == ts.SyntaxKind.PropertyAccessExpression) &&
		((callExpression.expression as ts.PropertyAccessExpression).expression.kind != ts.SyntaxKind.ThisKeyword)
	);
}

export function isMethodCall(callExpression: ts.CallExpression): boolean {
	return (
		(callExpression.expression.kind == ts.SyntaxKind.PropertyAccessExpression) &&
		((callExpression.expression as ts.PropertyAccessExpression).expression.kind == ts.SyntaxKind.ThisKeyword)
	);
}

export function isCompoundAssignmentOperator(op: ts.BinaryOperator): boolean {
	const compoundAssignmentOps = [
		ts.SyntaxKind.MinusEqualsToken,
		ts.SyntaxKind.AsteriskAsteriskEqualsToken,
		ts.SyntaxKind.AsteriskEqualsToken,
		ts.SyntaxKind.SlashEqualsToken,
		ts.SyntaxKind.PercentEqualsToken,
		ts.SyntaxKind.AmpersandEqualsToken,
		ts.SyntaxKind.BarEqualsToken,
		ts.SyntaxKind.CaretEqualsToken,
		ts.SyntaxKind.LessThanLessThanEqualsToken,
		ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
		ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
		ts.SyntaxKind.BarBarEqualsToken,
		ts.SyntaxKind.AmpersandAmpersandEqualsToken,
		ts.SyntaxKind.QuestionQuestionEqualsToken
	]
	return compoundAssignmentOps.indexOf(op) != -1;
}

export function compoundAssignmentOperatorToNumericOperator(op: ts.CompoundAssignmentOperator): ts.BinaryOperator {
	switch (op) {
		case ts.SyntaxKind.PlusEqualsToken: return ts.SyntaxKind.PlusToken;
		case ts.SyntaxKind.MinusEqualsToken: return ts.SyntaxKind.MinusToken;
		case ts.SyntaxKind.AsteriskEqualsToken: return ts.SyntaxKind.AsteriskToken;
		case ts.SyntaxKind.SlashEqualsToken: return ts.SyntaxKind.SlashToken;
		default:
			throw new Error(`unsupported CompoundAssignmentOperator: ${ts.SyntaxKind[op]}`);
	}
}

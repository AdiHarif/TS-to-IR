
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

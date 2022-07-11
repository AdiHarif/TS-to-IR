
import * as ts from "typescript"

import { expressionIrName } from "../../ir/utils";

export function createLoadModuleDeclaration(moduleName: string, imports: ts.PropertyAccessExpression[]): ts.FunctionDeclaration {

	let importsObjectLiteral: ts.ObjectLiteralExpression = ts.factory.createObjectLiteralExpression(
		imports.map((exp) => {
			return ts.factory.createPropertyAssignment(
				expressionIrName(exp),
				ts.factory.createPropertyAccessExpression(
					ts.factory.createIdentifier(exp.expression.getText()),
					ts.factory.createIdentifier(exp.name.getText())
				)
			)
		}),
		true
	);

	let importsVariableStatement: ts.VariableStatement = ts.factory.createVariableStatement(
		undefined,
		ts.factory.createVariableDeclarationList(
			[ ts.factory.createVariableDeclaration(
				'imports',
				undefined,
				ts.factory.createTypeReferenceNode(ts.factory.createQualifiedName(
					ts.factory.createIdentifier('WebAssembly'),
					ts.factory.createIdentifier('Imports')
				)),
				ts.factory.createObjectLiteralExpression(
					[ ts.factory.createPropertyAssignment(
							'env',
							importsObjectLiteral
					)],
					true
				)
			)],
			ts.NodeFlags.Const
		)
	);

	let arrayBufferArrowFunction = ts.factory.createArrowFunction(
		undefined,
		undefined,
		[ ts.factory.createParameterDeclaration(
			undefined,
			undefined,
			undefined,
			'res'
		)],
		undefined,
		ts.factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
		ts.factory.createCallExpression(
			ts.factory.createPropertyAccessExpression(
				ts.factory.createIdentifier('res'),
				ts.factory.createIdentifier('arrayBuffer')
			),
			undefined,
			undefined
		)
	);

	let bufferVariableStatement: ts.VariableStatement = ts.factory.createVariableStatement(
		undefined,
		ts.factory.createVariableDeclarationList(
			[ ts.factory.createVariableDeclaration(
				'buffer',
				undefined,
				undefined,
				ts.factory.createAwaitExpression(ts.factory.createCallExpression(
					ts.factory.createPropertyAccessExpression(
						ts.factory.createCallExpression(
							ts.factory.createPropertyAccessExpression(
								ts.factory.createCallExpression(
									ts.factory.createIdentifier('fetch'),
									undefined,
									[ ts.factory.createStringLiteral(moduleName) ]
								),
								'then'
							),
							undefined,
							[ arrayBufferArrowFunction ]
						),
						'then'
					),
					undefined,
					undefined
				))
			)],
			ts.NodeFlags.Const
		)
	);

	let moduleVariableStatement = ts.factory.createVariableStatement(
		undefined,
		ts.factory.createVariableDeclarationList(
			[ ts.factory.createVariableDeclaration(
				'module',
				undefined,
				undefined,
				ts.factory.createAwaitExpression(ts.factory.createCallExpression(
					ts.factory.createPropertyAccessExpression(
						ts.factory.createCallExpression(
							ts.factory.createPropertyAccessExpression(
								ts.factory.createIdentifier('WebAssembly'),
								ts.factory.createIdentifier('compile')
							),
							undefined,
							[ts.factory.createIdentifier('buffer')]
						),
						'then'
					),
					undefined,
					undefined
				))
			)],
			ts.NodeFlags.Const
		)
	);

	let instanceVariableStatement = ts.factory.createVariableStatement(
		undefined,
		ts.factory.createVariableDeclarationList(
			[ ts.factory.createVariableDeclaration(
				'instance',
				undefined,
				undefined,
				ts.factory.createAwaitExpression(ts.factory.createCallExpression(
					ts.factory.createPropertyAccessExpression(
						ts.factory.createIdentifier('WebAssembly'),
						ts.factory.createIdentifier('instantiate')
					),
					undefined,
					[
						ts.factory.createIdentifier('module'),
						ts.factory.createIdentifier('imports')
					]
				))
			)],
			ts.NodeFlags.Const
		)
	);

	let moduleExportsAssignment = ts.factory.createExpressionStatement(ts.factory.createBinaryExpression(
		ts.factory.createIdentifier('moduleExports'),
		ts.SyntaxKind.EqualsToken,
		ts.factory.createPropertyAccessExpression(
			ts.factory.createIdentifier('instance'),
			ts.factory.createIdentifier('exports')
		)
	))

	let statements: ts.Statement[] = [
		importsVariableStatement,
		bufferVariableStatement,
		moduleVariableStatement,
		instanceVariableStatement,
		moduleExportsAssignment
	];

	return ts.factory.createFunctionDeclaration(
		undefined,
		[ ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword) ],
		undefined,
		'loadModule',
		undefined,
		[],
		undefined,
		ts.factory.createBlock(statements, true)
	);
}

export function createLoadModuleStatements(moduleName: string, imports: ts.PropertyAccessExpression[]): ts.Statement[] {

	let moduleExportsVariableStatement = ts.factory.createVariableStatement(
		undefined,
		[ts.factory.createVariableDeclaration(
			'moduleExports',
			undefined,
			ts.factory.createTypeReferenceNode(ts.factory.createQualifiedName(
				ts.factory.createIdentifier('WebAssembly'),
				ts.factory.createIdentifier('Exports')
			))
		)]
	);

	let loadModuleFunctionDecleration = createLoadModuleDeclaration(moduleName, imports);

	let loadModuleCallStatement = ts.factory.createExpressionStatement(ts.factory.createAwaitExpression(
		ts.factory.createCallExpression(
			ts.factory.createIdentifier('loadModule'),
			undefined,
			undefined
		)
	));

	return [
		moduleExportsVariableStatement,
		loadModuleFunctionDecleration,
		loadModuleCallStatement
	];
}

export function createWrapTwinObjectDeclaration(type: ts.Type): ts.FunctionDeclaration {

	const typeName: string = type.getSymbol()!.getName();

	let wrapTwinObjectDeclaration = ts.factory.createFunctionDeclaration(
		undefined,
		undefined,
		undefined,
		'wrapTwinObject',
		undefined,
		[ ts.factory.createParameterDeclaration(
			undefined,
			undefined,
			undefined,
			'obj',
			undefined,
			ts.factory.createTypeReferenceNode('number')
		)],
		ts.factory.createTypeReferenceNode(typeName),
		ts.factory.createBlock(
			[ ts.factory.createReturnStatement(ts.factory.createAsExpression(
				ts.factory.createObjectLiteralExpression(
					[
						ts.factory.createPropertyAssignment(
							'twinObj',
							ts.factory.createIdentifier('obj')
						),
						ts.factory.createSpreadAssignment(ts.factory.createPropertyAccessExpression(
							ts.factory.createIdentifier(typeName),
							'prototype'
						))
					],
					true
				),
				ts.factory.createTypeReferenceNode(typeName)
			))],
			true
		)
	);

	return wrapTwinObjectDeclaration;
}

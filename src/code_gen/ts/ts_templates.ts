
import * as ts from "typescript"
import * as talt from "talt"

import { expressionIrName } from "../llvm/utils";
import * as cgm from "../manager"

export function createLoadModuleDeclaration(moduleName: string, imports: ts.PropertyAccessExpression[]): ts.FunctionDeclaration {

	const importsObjectLiteral: ts.ObjectLiteralExpression = ts.factory.createObjectLiteralExpression(
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

	const importsDeclaration: ts.Statement = talt.template.statement`
		const imports: WebAssembly.Imports = {
			env: IMPORTS_OBJECT_LITERAL
		}
	`({ IMPORTS_OBJECT_LITERAL: importsObjectLiteral });

	const bufferDeclaration = talt.template.statement`let buffer: ArrayBuffer;`();

	const bufferLoadingStatement: ts.Statement = talt.template.statement`
		if (typeof process !== "undefined" && process.versions.node) {
			const fs = await import('fs');
			buffer = fs.readFileSync("${cgm.getWasmFileName()}");
		}
			else {
			buffer = await fetch("${cgm.getWasmFileName()}").then(res => res.arrayBuffer());
		}
	`();

	const moduleDeclaration = talt.template.statement`
		const module = await WebAssembly.compile(buffer);
	`();

	const instanceDeclaration = talt.template.statement`
		const instance = await WebAssembly.instantiate(module, imports);
	`();

	const moduleExportsAssignment = talt.template.statement`
		moduleExports = instance.exports;
	`();

	// talt doesnt support instantiating templates with if statements at the moment
	const functionDeclaration = ts.factory.createFunctionDeclaration(
		undefined,
		[ ts.factory.createToken(ts.SyntaxKind.AsyncKeyword) ],
		undefined,
		'loadModule',
		undefined,
		[],
		undefined,
		ts.factory.createBlock([
			importsDeclaration,
			bufferDeclaration,
			bufferLoadingStatement,
			moduleDeclaration,
			instanceDeclaration,
			moduleExportsAssignment
		], true)
	)

	return functionDeclaration;
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

export function createWrapTwinObjectDeclaration(type: ts.Type): ts.MethodDeclaration {

	const typeName: string = type.getSymbol()!.getName();

	let wrapTwinObjectDeclaration = ts.factory.createMethodDeclaration(
		undefined,
		[ ts.factory.createModifier(ts.SyntaxKind.StaticKeyword) ],
		undefined,
		'wrapTwinObject',
		undefined,
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
						ts.factory.createSpreadAssignment(ts.factory.createCallExpression(
							ts.factory.createPropertyAccessExpression(
								ts.factory.createIdentifier('Object'),
								'getPrototypeOf'
							),
							undefined,
							[ ts.factory.createIdentifier(typeName) ]
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

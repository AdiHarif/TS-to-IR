
import * as ts from "typescript"
import * as talt from "talt"

import { expressionIrName } from "../llvm/llvm_utils";
import * as cgm from "../manager"
import { ReturnInstruction } from "../llvm/instructions";

export function createLoadModuleDeclaration(imports: ts.PropertyAccessExpression[]): ts.FunctionDeclaration {

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
		return instance.exports;
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


export function createLoadModuleStatements(imports: ts.PropertyAccessExpression[]): ts.Statement[] {

	const moduleExportsVariableStatement = talt.template.statement(
		`export const moduleExports = await loadModule();`
	)();

	const loadModuleFunctionDecleration = createLoadModuleDeclaration(imports);

	return [
		loadModuleFunctionDecleration,
		moduleExportsVariableStatement
	];
}

export function createWrapTwinObjectDeclaration(type: ts.Type): ts.MethodDeclaration {

	const typeName: string = type.getSymbol()!.getName();

	const returnStatement: ts.Statement = talt.template.statement(
		`
		return {
			twinObj: obj,
			__proto__: ${typeName}.prototype
		    } as unknown as ${typeName};
		`
	)();

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
		ts.factory.createBlock([ returnStatement ], true)
	);

	return wrapTwinObjectDeclaration;
}

export function createModuleLoaderSourceFile(): ts.SourceFile {
	return ts.factory.createSourceFile(
		createLoadModuleStatements(cgm.importedFunctionsNodes),
		ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
		ts.NodeFlags.None
	);
}


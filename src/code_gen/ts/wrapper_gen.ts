
import * as ts from 'typescript'

import * as cgm from '../manager.js'
import { methodDeclarationToIrName, typeFlagsToLlvmType } from '../llvm/llvm_utils';
import * as talt from "talt"

export function createWrapperMethodDeclaration(decl: ts.MethodDeclaration): ts.MethodDeclaration {

	let className: string = (decl.parent as ts.ClassDeclaration).name!.getText();

	let bodyCallExpression: ts.CallExpression = ts.factory.createCallExpression(
		ts.factory.createParenthesizedExpression(ts.factory.createAsExpression(
			ts.factory.createPropertyAccessExpression(
				ts.factory.createIdentifier('moduleExports'),
				methodDeclarationToIrName(decl)
			),
			ts.factory.createTypeReferenceNode('Function')
		)),
		undefined,
		[
			...decl.parameters.map((param) => {
				let paramName: string = param.name.getText();
				let paramType: ts.Type = cgm.checker.getTypeAtLocation(param);
				if (paramType.flags & ts.TypeFlags.Object) {
					return ts.factory.createPropertyAccessExpression(
						ts.factory.createIdentifier(paramName),
						'twinObj'
					);
				}
				return ts.factory.createIdentifier(paramName);
			}),
			ts.factory.createPropertyAccessExpression(
				ts.factory.createToken(ts.SyntaxKind.ThisKeyword),
				'twinObj'
			)
		]
	);

	let bodyStatement: ts.Statement;
	let retType: ts.Type = cgm.checker.getReturnTypeOfSignature(cgm.checker.getSignatureFromDeclaration(decl)!);
	if (!(retType.getFlags() & ts.TypeFlags.Void)) {
		if (retType.flags & ts.TypeFlags.Object) {
			let retTypeName: string = cgm.checker.typeToString(retType);
			bodyCallExpression = ts.factory.createCallExpression(
				ts.factory.createPropertyAccessExpression(
					ts.factory.createIdentifier(retTypeName),
					'wrapTwinObject'
				),
				undefined,
				[ bodyCallExpression ]
			)
		}
		bodyStatement = ts.factory.createReturnStatement(bodyCallExpression);
	}
	else {
		bodyStatement = ts.factory.createExpressionStatement(bodyCallExpression);
	}

	let methodMethodWrapper = ts.factory.createMethodDeclaration(
		undefined,
		undefined,
		undefined,
		decl.name.getText(),
		undefined,
		undefined,
		decl.parameters.map(param => ts.factory.createParameterDeclaration(
			undefined,
			undefined,
			undefined,
			param.name,
			undefined,
			ts.factory.createTypeReferenceNode(param.type!.getText()),
		)),
		ts.factory.createTypeReferenceNode(decl.type!.getText()),
		ts.factory.createBlock(
			[ bodyStatement ],
			true
		)
	);

	return methodMethodWrapper;
}

export function createWrapperConstructorDeclaration(decl: ts.ConstructorDeclaration): ts.ConstructorDeclaration {
	//TODO: merge with createWrapperMethodDeclaration
	const className: string = (decl.parent as ts.ClassDeclaration).name!.getText();
	const ctorName: string = `${className}_constructor`;

	let bodyStatement = ts.factory.createExpressionStatement(ts.factory.createBinaryExpression(
		ts.factory.createPropertyAccessExpression(
			ts.factory.createToken(ts.SyntaxKind.ThisKeyword),
			'twinObj'
		),
		ts.SyntaxKind.EqualsToken,
		ts.factory.createCallExpression(
			ts.factory.createParenthesizedExpression(ts.factory.createAsExpression(
				ts.factory.createPropertyAccessExpression(
					ts.factory.createIdentifier('moduleExports'),
					ctorName
				),
				ts.factory.createTypeReferenceNode('Function')
			)),
			undefined,
			decl.parameters.map((param) => {
				let paramName: string = param.name.getText();
				let paramType: ts.Type = cgm.checker.getTypeAtLocation(param);
				let paramTypeName: string = cgm.checker.typeToString(paramType);
				if (paramTypeName == className) {
					return ts.factory.createPropertyAccessExpression(
						ts.factory.createIdentifier(paramName),
						'twinObj'
					);
				}
				return ts.factory.createIdentifier(paramName);
			})
		)
	));

	let wrapperCosntructorDeclaration = ts.factory.createConstructorDeclaration(
		undefined,
		undefined,
		decl.parameters.map(param => ts.factory.createParameterDeclaration(
			undefined,
			undefined,
			undefined,
			param.name,
			undefined,
			ts.factory.createTypeReferenceNode(param.type!.getText()),
		)),
		ts.factory.createBlock([ bodyStatement ], true)
	);

	return wrapperCosntructorDeclaration;
}

export function createWrapperClassDecleration(className: string, members: ts.ClassElement[]): ts.ClassDeclaration {

	let twinObjPropertyDecleration = ts.factory.createPropertyDeclaration(
		undefined,
		[ ts.factory.createToken(ts.SyntaxKind.PublicKeyword) ],
		'twinObj',
		undefined,
		ts.factory.createTypeReferenceNode('number'),
		undefined
	);

	let wrapperClassDecleration = ts.factory.createClassDeclaration(
		undefined,
		[ ts.factory.createModifier(ts.SyntaxKind.ExportKeyword) ],
		className,
		undefined,
		undefined,
		[
			twinObjPropertyDecleration,
			...members
		]
	);

	return wrapperClassDecleration;
}

export function createWrapperGetter(decl: ts.PropertyDeclaration): ts.AccessorDeclaration {

	let propName: string = decl.name.getText();
	let wasmGetterName: string = `get_${propName}_${decl.parent.name!.getText()}`;

	const callExpression = talt.template.expression(
		`(moduleExports.${wasmGetterName} as Function)(this.twinObj)`
	)();

	let returnStatementTemplate;
	let type = cgm.checker.getTypeFromTypeNode(decl.type!);
	if (type.flags & ts.TypeFlags.Object) {
		const typeName = cgm.checker.typeToString(type);
		returnStatementTemplate = talt.template.statement(
			`return ${typeName}.wrapTwinObject(CALL_EXPRESSION);`
		);
	}
	else {
		returnStatementTemplate = talt.template.statement(
			`return CALL_EXPRESSION;`
		);
	}
	const returnStatement = returnStatementTemplate({
		CALL_EXPRESSION: callExpression
	});

	let wrapperGetter = ts.factory.createGetAccessorDeclaration(
		undefined,
		undefined,
		propName,
		[],
		ts.factory.createTypeReferenceNode(decl.type!.getText()),
		ts.factory.createBlock(
			[ returnStatement ],
			true
		)
	);

	return wrapperGetter;
}

export function createWrapperSetter(decl: ts.PropertyDeclaration): ts.AccessorDeclaration {

	let propName: string = decl.name.getText();
	let wasmSetterName: string = `set_${propName}_${decl.parent.name!.getText()}`;

	let propetyArgument: ts.Expression;
	const type = cgm.checker.getTypeFromTypeNode(decl.type!);
	if (type.flags & ts.TypeFlags.Object) {
		propetyArgument = talt.template.expression(`${propName}.twinObj`)();
	}
	else {
		propetyArgument = talt.template.expression(propName)();
	}

	const bodyStatement = talt.template.statement(
		`(moduleExports.${wasmSetterName} as Function)(PROPERTY_ARGUMENT, this.twinObj);`
	)({
		PROPERTY_ARGUMENT: propetyArgument
	});

	let wrapperSetter = ts.factory.createSetAccessorDeclaration(
		undefined,
		undefined,
		propName,
		[ ts.factory.createParameterDeclaration(
			undefined,
			undefined,
			undefined,
			propName,
			undefined,
			ts.factory.createTypeReferenceNode(decl.type!.getText()),
			undefined,
		)],
		ts.factory.createBlock(
			[ bodyStatement ],
			true
		)
	);

	return wrapperSetter;
}

export function createWrapperSourceFile(statements: ts.Statement[]): ts.SourceFile {
	return ts.factory.createSourceFile(
		statements,
		ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
		ts.NodeFlags.None
	);
}

export function createWrapperFunctionDeclaration(functionDeclaration: ts.FunctionDeclaration): ts.FunctionDeclaration {

	let bodyExpression = ts.factory.createCallExpression(
		talt.template.expression`
			(moduleExports.${functionDeclaration.name!.text} as Function)
		`(),
		undefined,
		functionDeclaration.parameters.map(param =>
			ts.factory.createIdentifier(param.name.getText())
		)
	)

	let bodyStatement: ts.Statement;
	if (!(cgm.checker.getReturnTypeOfSignature(cgm.checker.getSignatureFromDeclaration(functionDeclaration)!).flags & ts.TypeFlags.Void)) {
		bodyStatement = ts.factory.createReturnStatement(bodyExpression)
	}
	else {
		bodyStatement = ts.factory.createExpressionStatement(bodyExpression);
	}

	const wrapperFunctionDeclaration = ts.factory.createFunctionDeclaration(
		functionDeclaration.decorators,
		functionDeclaration.modifiers,
		functionDeclaration.asteriskToken,
		functionDeclaration.name,
		functionDeclaration.typeParameters,
		functionDeclaration.parameters,
		functionDeclaration.type,
		ts.factory.createBlock([ bodyStatement ])
	)

	return wrapperFunctionDeclaration;
}

export function createModuleLoaderImportStatement(): ts.Statement {
	return talt.template.statement`
		import { moduleExports } from './wasm_loader.js'
	`();
}

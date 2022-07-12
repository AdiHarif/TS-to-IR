
import * as ts from 'typescript'

import * as cgm from '../manager.js'
import { methodDeclarationToIrName } from '../../ir/utils';

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
				let paramTypeName: string = cgm.checker.typeToString(paramType);
				if (paramTypeName == className) {
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
		let retTypeName: string = cgm.checker.typeToString(retType);
		if (retTypeName == className) {
			bodyCallExpression = ts.factory.createCallExpression(
				ts.factory.createIdentifier('wrapTwinObject'),
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
		[ ts.factory.createToken(ts.SyntaxKind.PrivateKeyword) ],
		'twinObj',
		undefined,
		ts.factory.createTypeReferenceNode('number'),
		undefined
	);

	let wrapperClassDecleration = ts.factory.createClassDeclaration(
		undefined,
		undefined,
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

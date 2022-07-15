
import * as ts from "typescript";

import * as cgm from "../manager.js"

export function typeToLlvmType(type: ts.Type | null, forceObjPtr: boolean = false): string {
	if (type == null) {
		return typeFlagsToLlvmType(ts.TypeFlags.Void);
	}
	if (type.isClass() || type.flags & ts.TypeFlags.TypeParameter) {
		let out = '%' + type.symbol.getName();
		if (forceObjPtr) {
			out += '*';
		}
		return out;
	}
	return typeFlagsToLlvmType(type.getFlags());
}

export function typeFlagsToLlvmType(typeFlags: ts.TypeFlags): string {
	if (typeFlags & ts.TypeFlags.Void) {
		return 'void';
	}
	if ((typeFlags & ts.TypeFlags.Number) ||
	    (typeFlags & ts.TypeFlags.NumberLiteral)) {
		return 'float';
	}
	if (typeFlags & ts.TypeFlags.Boolean) {
		return 'i1';
	}
	return 'unsupported-type(' + ts.TypeFlags[typeFlags] + ')';
}

export function regIndexToString(reg: number): string {
	if (reg == undefined) {
		return 'undefined-reg'
	}
	if (reg < 0) { //i.e. this is a function variable
		return '%' + (-1 - reg).toString();
	}
	return '%r' + reg.toString();
}

export function labelIndexToString(label: number): string {
	return "%l" + label.toString()
}

export function expressionIrName(exp: ts.PropertyAccessExpression): string {
	return exp.expression.getText() + '_' + exp.name.getText();
}

export function methodDeclarationToIrName(decl: ts.MethodDeclaration): string {
	return `${(decl.parent as ts.ClassDeclaration).name!.getText()}_${decl.name!.getText()}`
}
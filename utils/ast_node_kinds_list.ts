
import * as ts from "typescript";

let nodes_kind: Set<ts.SyntaxKind>;

function traverse(node: ts.Node, depth: number): void {
	let kind: ts.SyntaxKind = node.kind;
	nodes_kind.add(kind);
	node.forEachChild(child => { traverse(child, depth + 1)});
}

function main(): void {
	nodes_kind = new Set<ts.SyntaxKind>();
	const fileNames = process.argv.slice(2);
	const program = ts.createProgram(fileNames, {});
	let sourceFiles = program.getSourceFiles().filter(sf => !sf.isDeclarationFile);
	sourceFiles.forEach(sf => traverse(sf, 0));
	nodes_kind.forEach(kind => console.log(ts.SyntaxKind[kind]));
}

main();

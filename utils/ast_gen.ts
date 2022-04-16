
import * as ts from "typescript";

function traverse(node: ts.Node, depth: number): void {
	let kind: ts.SyntaxKind = node.kind;
	console.log('\t'.repeat(depth) + ts.SyntaxKind[kind]);
	node.forEachChild(child => { traverse(child, depth + 1)});
}

function main(): void {
	const fileNames = process.argv.slice(2);
	const program = ts.createProgram(fileNames, {});
	let sourceFiles = program.getSourceFiles().filter(sf => !sf.isDeclarationFile);
	sourceFiles.forEach(sf => traverse(sf, 0));
}

main();


import { compileProgram } from "./code_gen/code_gen.js"

function main(): void {
	const fileNames = process.argv.slice(2);
	compileProgram(fileNames);
}

main();

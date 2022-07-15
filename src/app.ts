
import { compileProgram } from "./code_gen/code_gen.js"
import * as cgm from "./code_gen/manager.js"
import * as cmd from "./cmd_line"

function main(): void {
	const args = cmd.parseCommandLineArgs();
	cgm.InitManager(args.sourceFile, args.outputFolder);
	compileProgram();
}

main();

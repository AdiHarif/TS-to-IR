
import { processProgram } from "./code_gen/statements"
import * as cgm from "./code_gen/manager.js"
import * as cmd from "./cmd_line"

function main(): void {
	const args = cmd.parseCommandLineArgs();
	cgm.InitManager(args.sourceFiles, args.outputFolder);
	processProgram();
}

main();


import { parse } from "ts-command-line-args";
import { compileProgram } from "./code_gen/code_gen.js"
import * as cgm from "./code_gen/manager.js"

interface CommandLineArguments {
	sourceFile: string,
	outputFolder: string,
};

function main(): void {

	const args: CommandLineArguments = parse<CommandLineArguments>({
		sourceFile: { type: String, defaultOption: true },
		outputFolder: { type: String, alias: 'o', defaultValue: 'out' },
	});
	cgm.InitManager(args.sourceFile.toString(), args.outputFolder.toString());
	compileProgram();
}

main();


import { parse } from "ts-command-line-args";
import { compileProgram } from "./code_gen/code_gen.js"
import * as cgm from "./code_gen/manager.js"

interface CommandLineArguments {
	sourceFile: string,
	outputFile: string,
};

function main(): void {

	const args: CommandLineArguments = parse<CommandLineArguments>({
		sourceFile: { type: String, defaultOption: true },
		outputFile: { type: String, alias: 'o', defaultValue: 'a.llvm' },
	});
	cgm.InitManager(args.sourceFile.toString(), args.outputFile.toString());
	compileProgram();
}

main();

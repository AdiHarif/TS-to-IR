
import * as cmd from "ts-command-line-args";

interface CommandLineArguments {
	sourceFile: string,
	outputFolder: string,
};




export function parseCommandLineArgs(): CommandLineArguments {
	return cmd.parse<CommandLineArguments>({
		sourceFile: { type: String, defaultOption: true },
		outputFolder: { type: String, alias: 'o', defaultValue: 'out' },
	});
}

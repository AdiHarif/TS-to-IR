
import * as cmd from "ts-command-line-args";

interface CommandLineArguments {
	sourceFiles: Array<string>,
	outputFolder: string,
};




export function parseCommandLineArgs(): CommandLineArguments {
	return cmd.parse<CommandLineArguments>({
		sourceFiles: { type: String, multiple: true, defaultOption: true },
		outputFolder: { type: String, alias: 'o', defaultValue: 'out' },
	});
}


import * as cmd from "ts-command-line-args";

export interface CommandLineArguments {
	sourceFiles: Array<string>,
	outputDir: string,
};

export function parseCommandLineArgs(): CommandLineArguments {
	return cmd.parse<CommandLineArguments>({
		sourceFiles: { type: String, multiple: true, defaultOption: true },
		outputDir: { type: String, alias: 'o', defaultValue: 'out' },
	});
}

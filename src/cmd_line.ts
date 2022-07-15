
import * as cmd from "ts-command-line-args";

export interface CommandLineArguments {
	sourceFilePath: string,
	outputDir: string,
};

export function parseCommandLineArgs(): CommandLineArguments {
	return cmd.parse<CommandLineArguments>({
		sourceFilePath: { type: String, defaultOption: true },
		outputDir: { type: String, alias: 'o', defaultValue: 'out' },
	});
}

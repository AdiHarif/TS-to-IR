
import * as cmd from "ts-command-line-args";

export interface CommandLineArguments {
	sourceFiles: Array<string>,
	outputDir: string,
	partialCompiling: boolean,
	configFile?: string
};

export function parseCommandLineArgs(): CommandLineArguments {
	return cmd.parse<CommandLineArguments>({
		sourceFiles: { type: String, multiple: true, defaultOption: true },
		outputDir: { type: String, alias: 'o', defaultValue: 'out' },
		partialCompiling: { type: Boolean, defaultValue: false },
		configFile: { type: String, optional: true },
	},
	{
		loadFromFileArg: 'configFile',
	});
}

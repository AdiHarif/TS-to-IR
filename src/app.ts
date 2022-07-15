
import { compileProgram } from "./code_gen/code_gen.js"
import * as gctx from "./code_gen/global_ctx.js"
import * as cmd from "./cmd_line"

function main(): void {
	const args = cmd.parseCommandLineArgs();
	const globalCtx = new gctx.GlobalCtx(args);
	compileProgram(globalCtx.getSourceFile(), globalCtx);
}

main();

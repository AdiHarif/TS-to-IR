
# Fireworks Demo

This demo is demonstrating the usage of [TS-to-IR](https://github.com/AdiHarif/TS-to-IR) tool.

Source files compiled using the tool in the demo are based on this [fireworks animation](http://www.sunshine2k.de/coding/javascript/graphiceffects/01_fireworks/01_fireworks.html) by [Bastian Molkenthin](http://www.sunshine2k.de/index.html), and can be found under res directory.

## Requirements

In order for the demo to run successfully, TS-to-IR tool must first be cloned and installed properly.

LLVM static compiler and linker (version 12 or higher) must be installed on the system as well. This can be verified using the following commands:
``` bash
llc --version # must be 12.0.0 or higher
wasm-ld --version # must be 12.0.0 or higher
```

If not installed properly these can be downloaded with your favorite package manager (llvm and lld packages) or here - https://releases.llvm.org/

## Starting the Demo

To start the demo, run this command from TS-to-IR root directory:
```
npm run demo
```
This will trigger [fireworks_demo.sh](https://github.com/AdiHarif/TS-to-IR/blob/main/scripts/fireworks_demo.sh) found in scripts directory, and when finished compiling some of the fireworks files, it will start the animation in a new browser tab.

## Step By Step

These are the steps being executed by the demo. All commands can be found in [fireworks_demo.sh](https://github.com/AdiHarif/TS-to-IR/blob/main/scripts/fireworks_demo.sh).

1. Preperation - checking for dependancies, cleaning up files from previous runs and copying required files to misc/demo directory.

1. TS-to-IR Run - compiling [Vector2D.ts](https://github.com/AdiHarif/TS-to-IR/blob/main/res/Fireworks/src/Vector2D.ts) and [PartialParticle2D.ts](https://github.com/AdiHarif/TS-to-IR/blob/main/res/Fireworks/src/PartialParticle2D.ts) from fireworks directory to LLVM IR, and creates aditional TypeScript files that will later on let us import the compiled logic and bind it to the rest of the fireworks project.
	``` bash
	npm start \
		$FIREWORKS_SRC_DIR/Vector2D.ts \
		$FIREWORKS_SRC_DIR/PartialParticle2D.ts
	```
	The files created in this process are:
	- module.llvm - containing all compiled logic and object type definitions in LLVM IR.
	- Vector2D.ts (wrapper) - contains TypeScript declerations for a Vector2D class and its methods from the original Vector2D.ts file. However, the implementation of these methods is replaced with a call for their compiled counterpart/
	- PartialParticle2D.ts (wrapper) - same as Vector2D wrapper for PartialParticle2D class and methods.
	- wasm_loader.ts - this will load our WebAssembly module (that later will be created out of module.llvm) before it is used in other TS files.

1. Compiling module.llvm to WebAssembly - creating tmp.wasm using LLVM static compiler
	``` bash
	llc --march=wasm32 --filetype=obj $OUT_DIR/module.llvm \
		-o $OUT_DIR/tmp.wasm
	```
1. WebAssembly Linking - linking the created module with a WebAssembly implementation of malloc, so memory for objects will be allocated properly
	``` bash
	wasm-ld --export-all --no-entry --allow-undefined \
		$OUT_DIR/tmp.wasm res/walloc.wasm \
		-o $OUT_DIR/module.wasm
	```

1. Compiling Fireworks Project - WebAssembly module and all TypeScript wrappers are copied to the demo directory. Then the entire fireworks project is compiled with the wrapper files using TypeScript Compiler (tsc)

1. Demo Run - after all of the above is done, the fireworks animation is opened in browser using live-server.
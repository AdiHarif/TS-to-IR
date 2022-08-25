#!/bin/bash -e

source ./scripts/script_utils.sh

DEMO_DIR="./misc/fireworks_demo"
DEMO_SRC_DIR="$DEMO_DIR/src"
DEMO_DIST_DIR="$DEMO_DIR/dist"

FIREWORKS_DIR="./res/Fireworks"
FIREWORKS_SRC_DIR="$FIREWORKS_DIR/src"
FIREWORKS_DIST_DIR="$FIREWORKS_DIR/dist"

OUT_DIR="./out"

check_dependencies() {
	llc --version > /dev/null
	wasm-ld --version > /dev/null
	npx live-server --version > /dev/null
}

copy_fireworks_source_files() {
	rm -rf $DEMO_DIR

	mkdir -p $DEMO_DIR
	cp $FIREWORKS_DIR/tsconfig.json $DEMO_DIR

	mkdir -p $DEMO_DIST_DIR
	cp $FIREWORKS_DIR/dist/index.html $DEMO_DIST_DIR

	mkdir -p $DEMO_SRC_DIR
	cp \
		$FIREWORKS_SRC_DIR/app.ts \
		$FIREWORKS_SRC_DIR/Firework.ts \
		$FIREWORKS_SRC_DIR/FireWorkParticle.ts \
		$FIREWORKS_SRC_DIR/GraphicsLoop.ts \
		$FIREWORKS_SRC_DIR/Particle2D.ts \
		$FIREWORKS_SRC_DIR/Util.ts \
		$DEMO_SRC_DIR
}

copy_out_files_to_demo_dir() {
	cp \
		$OUT_DIR/Vector2D.ts \
		$OUT_DIR/PartialParticle2D.ts \
		$OUT_DIR/wasm_loader.ts \
		$DEMO_SRC_DIR

	cp $OUT_DIR/module.wasm $DEMO_DIST_DIR

}

run_demo() {
	echo "===== Checking for dependencies ====="
	check_dependencies

	echo "===== Copying fireworks source files ====="
	copy_fireworks_source_files

	echo "===== Compiling Vector2D.ts and PartialParticle2D.ts to llvm ir ====="
	rm -rf ./$OUT_DIR/*
	mkdir -p $OUT_DIR
	npm start $FIREWORKS_SRC_DIR/Vector2D.ts $FIREWORKS_SRC_DIR/PartialParticle2D.ts

	echo "===== Compililng llvm module to wasm ====="
	llc --march=wasm32 --filetype=obj $OUT_DIR/module.llvm -o $OUT_DIR/tmp.wasm

	echo "===== Linking wasm module with walloc ====="
	wasm-ld --export-all --no-entry --allow-undefined $OUT_DIR/tmp.wasm res/walloc/walloc.wasm -o $OUT_DIR/module.wasm

	echo "===== Copying compiled wasm and wrapper files to demo dir ====="
	copy_out_files_to_demo_dir

	echo "===== Compiling fireworks demo with tsc ====="
	pushd $DEMO_DIST_DIR
	tsc
	popd

	echo "===== Starting demo with live-server ====="
	npx live-server $DEMO_DIST_DIR
}

run_demo

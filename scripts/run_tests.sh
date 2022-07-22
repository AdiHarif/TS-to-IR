#!/bin/bash

source ./scripts/script_utils.sh

TESTS_DIR="./tests"
LLVM_UTIL_DIR="../../res"

PROCESSING_COMMAND="node ../../build/app.js"

throw_error() {
	error_message=$1

	echo "Error: $error_message"
	echo "=== Test Failed ==="
	exit 1
}

run_test() {
	test_name=$1

	echo "=== Running test: $test_name ==="

	pushd $test_name

	source_file="$test_name.ts"
	llvm_file="$test_name.llvm"
	wasm_file="$test_name.wasm"
	prelink_wasm_file="prelink_$wasm_file"
	test_out_dir="test_out"
	mkdir $test_out_dir

	rm -rf $test_out_dir/*

	echo "Processing $source_file"
	$PROCESSING_COMMAND $source_file -o $test_out_dir || throw_error "Processing failed"
	echo "$source_file precessed successfully"

	pushd $test_out_dir
	echo "Compiling $llvm_file to prelinked wasm"
	llc --march=wasm32 --filetype=obj $llvm_file -o $prelink_wasm_file || throw_error "LLVM compilation failed"

	echo "Linking $wasm_file"
	wasm-ld --export-all --no-entry --allow-undefined $prelink_wasm_file -o $wasm_file || throw_error "Linking failed"

	wrapper_file=$source_file
	echo "Compiling $wrapper_file (wrapper)"
	tsc $wrapper_file --target ESNEXT --module ESNEXT || throw_error "Wrapper compilation failed"

	js_file="$test_name.js"
	echo "Running $js_file with $wasm_file module"
	node $js_file || throw_error "Run failed"

	echo "=== Test passed ==="
	echo ""
	popd
	popd
}

run_all_tests() {
	pushd $TESTS_DIR

	for dir in * ; do
		if [[ -d $dir ]]; then
			run_test $dir
		fi
	done

	popd

	echo "All tests passed!"
}

run_all_tests
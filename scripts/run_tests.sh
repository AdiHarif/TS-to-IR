#!/bin/bash

source ./scripts/script_utils.sh

TESTS_DIR="./tests"
LLVM_UTIL_DIR="../../res"

COMPILE_COMMAND="node ../../build/app.js"
LINK_COMMAND="llvm-link -S"

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
	echo "Compiling $source_file to $llvm_file."
	$COMPILE_COMMAND $source_file > $llvm_file || throw_error "Compilation failed."
	echo "$llvm_file created successfully."

	echo "Linking $llvm_file whith llvm util files"
	llvm_util_files="$(ls $LLVM_UTIL_DIR/*.llvm)"
	llvm_full_file=$test_name"_full.llvm"
	$LINK_COMMAND $llvm_file $llvm_util_files -o $llvm_full_file || throw_error "Linkage failed"

	echo "Running $llvm_full_file with input files."
	for in_file in *.in ; do
		io_name=${in_file%.*}
		res_file="$io_name.res"
		llvm_cmd="lli $llvm_full_file"
		#TODO: add handling return value of main function and checking exit status
		$llvm_cmd < $in_file > $res_file # || throw_error "lli failed with $llvm_full_file and $in_file as input"
		out_file="$io_name.out"
		diff $res_file $out_file || throw_error "Output is not as expected with $in_file as input"
	done
	io_count=$(ls -l *.in | wc -l)
	echo "All outputs($io_count) for the test matched the expected output."

	popd

	echo "=== Test passed ==="
	echo ""
}

run_all_tests() {
	pushd $TESTS_DIR

	for d in * ; do
		run_test $d
	done

	popd

	echo "All tests passed!"
}

run_all_tests
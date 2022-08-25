
# TS to IR

TS to IR is a tool for compiling TypeScript code to WebAssembly.

## Install

To install, clone the repository and use npm

```
npm install
```

## Usage

To run this tool use npm start and pass all input files as args

```
npm start <file1.ts> <file2.ts> ...
```
This will create a module.llvm file containing llvm ir implementations of the input files. Then we can compile it to WebAssembly using the llvm static compiler (llc). The tool will also create TypeScript files to import the WebAssembly module and bind it's methods to TypeScript functions and classes that can be used in other files.

All files will created in a directory called 'out' by default. this can be changed by passing -o flag with a desired directory path.

> Note that the output directory must be created before using the tool, and won't be created in the process.

## Demo

Use npm to start a fireworks demo on browser with live-server
```
npm run demo
```
> Note that llvm static compiler (llc command) and llvm based linker (wasm-ld command) must be installed

## Testing

Use npm to run all tests in tests dir
```
npm run test
```
> Note that llvm static compiler (llc command) and llvm based linker (wasm-ld command) must be installed
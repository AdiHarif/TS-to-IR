var moduleExports: WebAssembly.Exports;
async function loadModule() {
    const imports: WebAssembly.Imports = {
        env: {}
    };
    let buffer: ArrayBuffer;
    if (typeof process !== "undefined" && process.versions.node) {
        const fs = await import("fs");
        buffer = fs.readFileSync("add.wasm");
    }
    else {
        buffer = await fetch("add.wasm").then(res => res.arrayBuffer());
    }
    const module = await WebAssembly.compile(buffer);
    const instance = await WebAssembly.instantiate(module, imports);
    moduleExports = instance.exports;
}
await loadModule();
import { strict as assert } from "assert";
function add(x: number, y: number): number { return (moduleExports.add as Function)(x, y); }
assert(add(0, 0) == 0);
assert(add(1, 0) == 1);
assert(add(1, 1) == 2);
assert(add(42, 42) == 84);
assert(add(-1, -1) == -2);
assert(add(1, -1) == 0);


import { strict as assert } from 'assert';

function nonCompiledAdd(x: number, y: number): number {
	let z = x + y;
	return z;
}

/** @ir_compile */
function compiledAdd(x: number, y: number): number {
	let z = x + y;
	return z;
}

assert(compiledAdd(0, 0) == 0);
assert(compiledAdd(1, 0) == 1);
assert(compiledAdd(1, 1) == 2);
assert(compiledAdd(42, 42) == 84);
assert(compiledAdd(-1, -1) == -2);
assert(compiledAdd(1, -1) == 0);

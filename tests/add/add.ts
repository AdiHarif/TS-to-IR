
import { strict as assert } from 'assert';

function add(x: number, y: number): number {
	let z = x + y;
	return z;
}

assert(add(0, 0) == 0);
assert(add(1, 0) == 1);
assert(add(1, 1) == 2);
assert(add(42, 42) == 84);
assert(add(-1, -1) == -2);
assert(add(1, -1) == 0);
//TODO: add floats checks (using smart comparisoon with number.Epsilon)

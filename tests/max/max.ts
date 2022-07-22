
import { strict as assert } from 'assert';

function max(a: number, b: number): number {
	if (a > b) {
		return a;
	}
	return b;
}

assert(max(1, 2) == 2);
assert(max(2, 2) == 2);
assert(max(1, -1) == 1);
assert(max(-1, -2) == -1);
//TODO: add floats checks (using smart comparisoon with number.Epsilon)

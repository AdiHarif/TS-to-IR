
import { strict as assert } from 'assert';

function recFib(n: number): number {
	if (n < 0) {
		return -1;
	}
	if (n < 2) {
		return n;
	}
	return (recFib(n-1) + recFib(n-2));
}

assert(recFib(-1) == -1);
assert(recFib(0) == 0);
assert(recFib(1) == 1);
assert(recFib(2) == 1);
assert(recFib(3) == 2);
assert(recFib(4) == 3);
assert(recFib(5) == 5);
assert(recFib(6) == 8);
assert(recFib(7) == 13);
assert(recFib(20) == 6765);
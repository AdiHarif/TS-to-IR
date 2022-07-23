
import { strict as assert } from 'assert';

function iterFib(n: number): number {
	if (n < 0) {
		return -1;
	}
	if (n < 2) {
		return n;
	}
	let prev1: number = 0;
	let prev2: number = 1;
	for (let i: number = 2; i <= n; i++) {
		let current: number = prev1 + prev2;
		prev1 = prev2;
		prev2 = current;
	}
	return prev2;
}

assert(iterFib(-1) == -1);
assert(iterFib(0) == 0);
assert(iterFib(1) == 1);
assert(iterFib(2) == 1);
assert(iterFib(3) == 2);
assert(iterFib(4) == 3);
assert(iterFib(5) == 5);
assert(iterFib(6) == 8);
assert(iterFib(7) == 13);
assert(iterFib(20) == 6765);

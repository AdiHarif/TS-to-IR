
import { strict as assert } from 'assert';

function iterFact(n: number): number {
	if (n < 0) {
		return -1;
	}
	let fact = 1;
	for (let i = 2; i <= n; i++) {
		fact *= i;
	}
	return fact;
}

assert(iterFact(-1) ==  -1);
assert(iterFact(0) == 1);
assert(iterFact(1) == 1);
assert(iterFact(2) == 2);
assert(iterFact(3) == 6);
assert(iterFact(4) == 24);
assert(iterFact(5) == 120);
assert(iterFact(6) == 720);
assert(iterFact(10) == 3628800);

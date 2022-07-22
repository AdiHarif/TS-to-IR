
import { strict as assert } from 'assert';

function recFact(n: number): number {
	if (n < 0){
		return -1;
	}
	if (n == 0){
		return 1;
	}
	return recFact(n - 1) * n;
}

assert(recFact(-1) ==  -1);
assert(recFact(0) == 1);
assert(recFact(1) == 1);
assert(recFact(2) == 2);
assert(recFact(3) == 6);
assert(recFact(4) == 24);
assert(recFact(5) == 120);
assert(recFact(6) == 720);
assert(recFact(10) == 3628800);

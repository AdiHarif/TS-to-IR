
import scanf from "scanf";

function recFib(n: number): number {
	if (n < 0) {
		return -1;
	}
	if (n < 2) {
		return n;
	}
	return (recFib(n-1) + recFib(n-2));
}

function main(): void {
	console.log(recFib(scanf("%d")));
}

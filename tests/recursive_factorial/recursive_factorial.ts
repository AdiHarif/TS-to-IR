
import scanf from "scanf";

function recFact(n: number): number {
	if (n < 0){
		return -1;
	}
	if (n == 0){
		return 1;
	}
	return recFact(n - 1) * n;
}

function main(): void {
	console.log(recFact(scanf("%d")));
}


import scanf from "scanf";

function max(a: number, b: number): number {
	if (a > b) {
		return a;
	}
	return b;
}

function main(): void {
	console.log(max(scanf("%d"), scanf("%d")));
}

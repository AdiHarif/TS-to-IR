
import scanf from "scanf";

function add(x: number, y: number): number {
	let z = x + y;
	return z;
}
function main(): void {
	console.log(add(scanf("%f"), scanf("%f")));
}


import { Vector2D } from "./Vector2D.js"

export class PartialParticle2D {
	public Position: Vector2D;
	public Speed: Vector2D;
	public Acceleration: Vector2D;
	public ColorR: number;
	public ColorG: number;
	public ColorB: number;
	public ColorA: number;

	constructor(pos: Vector2D, speed: Vector2D, acceleration: Vector2D) {
		this.Position = pos;
		this.Speed = speed;
		this.Acceleration = acceleration;

		this.ColorR = this.ColorG = this.ColorB = 255;
		this.ColorA = 1;
	}

	public update(): void {
		this.Speed.addVec(this.Acceleration);
		this.Position.addVec(this.Speed);
	}
	public SetColor(r: number, g: number, b: number, a: number): void {
		this.ColorR = r;
		this.ColorG = g;
		this.ColorB = b;
		this.ColorA = a;
	}
}

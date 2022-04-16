
export class Vector2D
{
	public X: number;
	public Y: number;

	constructor(x: number, y: number)
	{
		this.X = x;
		this.Y = y;
	}

	clone(): Vector2D {
		return new Vector2D(this.X, this.Y);
	}

	/* Length */
	getLength(): number {
		return Math.sqrt((this.X * this.X) + (this.Y * this.Y));
	}
	getLengthSquared(): number {
		return (this.X * this.X) + (this.Y * this.Y);
	}

	/* Normalization */
	normalize(): void {
		let mag: number = this.getLength();
		this.X = this.X / mag;
		this.Y = this.Y / mag;
	}

	getNormalized(): Vector2D {
		let mag: number = this.getLength();
		return new Vector2D(this.X / mag, this.Y / mag);
	}

	/* Addition */
	add(dx: number, dy: number): void {
		this.X += dx;
		this.Y += dy;
	}

	addVec(v: Vector2D): void {
		this.X += v.X;
		this.Y += v.Y;
	}

	getAdd(dx: number, dy: number): Vector2D {
		return new Vector2D(this.X + dx, this.Y + dy);
	}

	getAddVec(v: Vector2D): Vector2D {
		return new Vector2D(this.X + v.X, this.Y + v.Y);
	}

	/* Subtraction */
	sub(dx: number, dy: number): void {
		this.X -= dx;
		this.Y -= dy;
	}

	subVec(v: Vector2D): void {
		this.X -= v.X;
		this.Y -= v.Y;
	}

	getSub(dx: number, dy: number): Vector2D {
		return new Vector2D(this.X - dx, this.Y - dy);
	}

	getSubVec(v: Vector2D): Vector2D {
		return new Vector2D(this.X - v.X, this.Y - v.Y);
	}

	/* Multiplication */
	mul(s: number): void {
		this.X *= s; this.Y *= s;
	}

	getMul(s: number): Vector2D {
		return new Vector2D(this.X * s, this.Y * s);
	}

	/* Division */
	div(s: number): void {
		this.X /= s; this.Y /= s;
	}

	getDiv(s: number): Vector2D {
		return new Vector2D(this.X / s, this.Y / s);
	}

	/* Dot product */
	dotProduct(v: Vector2D): number {
		return ((this.X * v.X) + (this.Y * v.Y))
	}

	/* Perp dot product */
	perpDotProduct(v: Vector2D): number {
		return ((this.X * v.Y) - (this.Y * v.X))
	}

	/* Opposite */
	opposite(): void {
		this.X = -this.X; this.Y = -this.Y;
	}

	getOpposite(): Vector2D {
		return new Vector2D(-this.X, -this.Y);
	}

	/* Perpendicular */
	perpendicularCCW(): void {
		this.X = -this.Y; this.Y = this.X;
	}

	getPerpendicularCCW(): Vector2D {
		return new Vector2D(-this.Y, this.X);
	}

	perpendicularCW(): void {
		this.X = this.Y; this.Y = -this.X;
	}

	getPerpendicularCW(): Vector2D {
		return new Vector2D(this.Y, -this.X);
	}

	/* IsOrthogonal */
	IsOrthogonal(v: Vector2D): boolean {
		return this.dotProduct(v) == 0;
	}

	/* IsColinear */
	isColinear(v: Vector2D): boolean {
		return this.perpDotProduct(v) == 0;
	}

	/* Rotate */
	rotate(angle: number): void {
		let sin: number = Math.sin(angle);
		let cos: number = Math.cos(angle);
		let newX: number = this.X * cos - this.Y * sin;
		let newY: number = this.X * sin + this.Y * cos;
		this.X = newX;
		this.Y = newY;
	}

	getRotated(angle: number): Vector2D {
		let sin: number = Math.sin(angle);
		let cos: number = Math.cos(angle);
		let newX: number = this.X * cos - this.Y * sin;
		let newY: number = this.X * sin + this.Y * cos;
		return new Vector2D(newX, newY);
	}

	/* Polar */
	getVectorFromPolar(mag: number, angle: number): Vector2D {
		return new Vector2D(mag * Math.cos(angle), mag * Math.sin(angle));
	}

	getPolarMagnitude(): number {
		return this.getLength();
	}

	getPolarAngle(): number {
		if (this.X == 0)
		{
			if (this.Y > 0)
			{
				return Math.PI / 2;
			}
			else
			{
				return -Math.PI / 2;
			}
		}
		else if (this.X < 0)
		{
			if (this.Y >= 0)
			{
				return Math.atan(this.Y / this.X) + Math.PI / 2;
			}
			else
			{
				return Math.atan(this.Y / this.X) - Math.PI / 2;
			}
		}
		else
		{
			return Math.atan(this.Y / this.X);
		}
	}

	/* Projected */
	getProjectLength(v: Vector2D): number {
		return (this.dotProduct(v) / this.getLength());
	}

	getProjectVector(v: Vector2D): Vector2D {
		return this.getNormalized().getMul(this.dotProduct(v) / this.getLength());
	}
}



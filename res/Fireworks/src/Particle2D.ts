
import { Vector2D } from "./Vector2D.js"

export interface IParticle2DDraw
{
    displayParticle(ctx: CanvasRenderingContext2D, particle: Particle2D): void;
}

export class Particle2D
{
    public Position: Vector2D;
    public Speed: Vector2D;
    public Acceleration: Vector2D;
    private displayFunction?: IParticle2DDraw;
    public ColorR: number;
    public ColorG: number;
    public ColorB: number;
    public ColorA: number;

    constructor(xOrPos: number, yOrSpeed: number);
    constructor(xOrPos: Vector2D);
    constructor(xOrPos: Vector2D, yOrSpeed: Vector2D);
    constructor(xOrPos: Vector2D, yOrSpeed: Vector2D, acceleration: Vector2D);
    constructor(xOrPos: number | Vector2D, yOrSpeed?: Vector2D | number, acceleration?: Vector2D)
    {
        if (typeof xOrPos == "number")
        {
            this.Position = new Vector2D(<number>xOrPos, <number>yOrSpeed);
            this.Speed = new Vector2D(0, 0);
            this.Acceleration = new Vector2D(0, 0);
        }
        else
        {
            this.Position = <Vector2D>xOrPos;
            this.Speed = (yOrSpeed === undefined) ? new Vector2D(0, 0) : <Vector2D>yOrSpeed;
            this.Acceleration = (acceleration === undefined) ? new Vector2D(0, 0) : acceleration;
        }
        this.ColorR = this.ColorG = this.ColorB = 255;
        this.ColorA = 1;
    }

    public update = (time?: number): void =>
    {
        this.Speed.addVec(this.Acceleration);
        this.Position.addVec(this.Speed);
    }

    public display = (ctx: CanvasRenderingContext2D): void =>
    {
        if (this.displayFunction)
        {
            this.displayFunction.displayParticle(ctx, this);
        }
        else
        {
            ctx.fillStyle = this.GetColorRGBAString();
            ctx.fillRect(this.Position.X - 1, this.Position.Y - 1, 3, 3);
        }
    }

    public SetRenderFunction = (displayFunc: IParticle2DDraw): void =>
    {
        this.displayFunction = displayFunc;
    }

    public SetColor = (r: number, g: number, b: number, a: number): void =>
    {
        this.ColorR = r;
        this.ColorG = g;
        this.ColorB = b;
        this.ColorA = a;
    }

    public GetColorRGBAString = (): string =>
    {
        return "rgba(" + this.ColorR.toString() + ", " + this.ColorG.toString() + ", " + this.ColorB.toString() + ", " + this.ColorA.toString() + ")";
    }
}
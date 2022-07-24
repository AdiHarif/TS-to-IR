import { PartialParticle2D } from "./PartialParticle2D.js";

export interface IParticle2DDraw
{
    displayParticle(ctx: CanvasRenderingContext2D, particle: Particle2D): void;
}

export class Particle2D extends PartialParticle2D
{
    private displayFunction?: IParticle2DDraw;

    public display(ctx: CanvasRenderingContext2D): void {
        this.displayFunction!.displayParticle(ctx, this);
    }

    public SetRenderFunction(displayFunc: IParticle2DDraw): void {
        this.displayFunction = displayFunc;
    }

    public GetColorRGBAString(): string {
        return "rgba(" + this.ColorR.toString() + ", " + this.ColorG.toString() + ", " + this.ColorB.toString() + ", " + this.ColorA.toString() + ")";
    }
}
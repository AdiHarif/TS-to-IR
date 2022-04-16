
import { Util } from "./Util.js"
import { Particle2D, IParticle2DDraw } from "./Particle2D.js";
import { Vector2D } from "./Vector2D.js";
import { FireworkParticle } from "./FireWorkParticle.js";

/**
 * @class Firework
 */
export class FireWork
{
    private active: boolean;
    private exploded: boolean;

    private drawAreaHeight;

    private rocket: Particle2D;
    private explodeParticles: Array<FireworkParticle> = [];
    private smokeParticles: Array<FireworkParticle> = [];

    private static NUM_SMOKE_PARTICLES: number = 30;
    private static NUM_EXPLODE_PARTICLES: number = 250;

    constructor(width : number, height : number)
    {
        this.drawAreaHeight = height;
        let startPosX: number = Util.getRandomInt(width * 0.3, width * 0.7);
        let startPosY: number = height;
        let startSpeedX: number = Util.getRandom(-1.5, 1.5);
        let startSpeedY: number = -Util.getRandomInt(9.8, 11.8);
        let gravity: number = 0.12;

        // create main rocket particle
        this.rocket = new Particle2D(
            new Vector2D(startPosX, startPosY),
            new Vector2D(startSpeedX, startSpeedY),
            new Vector2D(0, gravity));
        let colorIdx: number = Util.getRandomInt(0, 6);
        switch (colorIdx)
        {
            case 0: this.rocket.SetColor(255, 70, 220, 1); break;   /* pink */
            case 1: this.rocket.SetColor(255, 237, 70, 1); break;   /* yellow */
            case 2: this.rocket.SetColor(255, 30, 30, 1);  break;   /* red */
            case 3: this.rocket.SetColor(70, 100, 245, 1); break;   /* blue */
            case 4: this.rocket.SetColor(75, 245, 170, 1); break;   /* green */
            case 5: this.rocket.SetColor(250, 150, 56, 1); break;   /* orange */
            case 6: this.rocket.SetColor(211, 56, 250, 1); break;   /* purple */
        }

        this.rocket.SetRenderFunction(new RocketParticleRenderer());

        // create smoke particles
        this.smokeParticles = new Array();
        let smokeRenderer = new SmokeParticleRenderer();
        for (let i = 0; i < FireWork.NUM_SMOKE_PARTICLES; i++)
        {
            let p: FireworkParticle = new FireworkParticle(
                new Vector2D(startPosX, startPosY),
                new Vector2D(-startSpeedX + Util.getRandom(-0.38, 0.38), Util.getRandom(0.55, 1.8)),
                new Vector2D(0, 0.01));

            p.SetColor(170, 150, 160, 0.4);
            p.SetRenderFunction(smokeRenderer);
            p.FadeFactor = Util.getRandom(0.40, 0.98);
            this.smokeParticles.push(p);
        }

        this.exploded = false;
        this.active = true;
    }

    public update = (): boolean =>
    {
        let retVal: boolean = false;

        if (!this.active) return retVal;

        /* check if rocket shall explode (if too slow) */
        if (!this.exploded && this.rocket.Speed.Y >= -0.1)
        {
            retVal = true;
            this.explode();
        }
        
        if (!this.exploded)
        {
            /* process rocket particle */
            this.rocket.update();

            /* process smoke particles */
            for (let i = 0; i < this.smokeParticles.length; i++)
            {
                /* correct position of smoke particle so that they follow the movement of the rocket */
                this.smokeParticles[i].Speed.addVec(this.rocket.Acceleration);
                this.smokeParticles[i].Position.addVec(this.rocket.Speed);
                /* update position, speed and color */
                this.smokeParticles[i].update();
                this.smokeParticles[i].ColorA *= this.smokeParticles[i].FadeFactor;

                /* if smoke particle fades out, replace it with new particle starting from rocket */
                if (this.smokeParticles[i].ColorA <= 0.04)
                {
                    this.smokeParticles[i].Position.X = this.rocket.Position.X - 1;
                    this.smokeParticles[i].Position.Y = this.rocket.Position.Y + 3;
                    this.smokeParticles[i].Speed.X = Util.getRandom(-0.58, 0.58);
                    this.smokeParticles[i].Speed.Y = Util.getRandom(0.55, 1.3);
                    this.smokeParticles[i].ColorA = 1;
                    this.smokeParticles[i].FadeFactor = Util.getRandom(0.80, 0.98);
                }
            }
        }
        else
        {
            /* process explode particles */
            for (let i = 0; i < this.explodeParticles.length; i++)
            {
                this.explodeParticles[i].update();
                this.explodeParticles[i].Speed.X *= 0.995; /* slow down also in x direction */
                this.explodeParticles[i].ColorA *= this.explodeParticles[i].FadeFactor;
        
                /* remove explode particle if faded out or out of visible field of canvas */
                if (this.explodeParticles[i].ColorA <= 0.03 || this.explodeParticles[i].Position.Y > this.drawAreaHeight)
                {
                    this.explodeParticles.splice(i, 1);
                    i--;
                }
            }

            /* if all particles exploded, set firework to finish state */
            if (this.explodeParticles.length <= 1)
            {
                this.active = false;
            }
        }

        return retVal;
    }

    /** Display the firework */
    public display = (ctx: CanvasRenderingContext2D): void =>
    {
        if (!this.active) return;

        if (!this.exploded)
        {
            this.rocket.display(ctx);
            for (let i = 0; i < this.smokeParticles.length; i++)
            {
                this.smokeParticles[i].display(ctx);
            }
        }
        else
        {
            for (let i = 0; i < this.explodeParticles.length; i++)
            {
                this.explodeParticles[i].display(ctx);
            }
        }
    }

    /** Gets the active state of the firework */
    public isActive = (): boolean =>
    {
        return this.active;
    }

    /* Explode firework. Remove the smoke particles and create the explode particles */
    private explode = (): void =>
    {
        this.explodeParticles = new Array();
        let explodeParticleRenderer = new ExplodeParticleRenderer();

        /* let the firework explode in several ways */
        let explodeIdx: number = Util.getRandomInt(0, 2);
        for (let i = 0; i < FireWork.NUM_EXPLODE_PARTICLES; i++)
        {
            let p: FireworkParticle;
            switch (explodeIdx)
            {
                case 0:
                    p = new FireworkParticle(
                        new Vector2D(this.rocket.Position.X, this.rocket.Position.Y),
                        new Vector2D(Util.getRandom(-1.5, 1.5) + this.rocket.Speed.X, Util.getRandom(-2.2, 0.4) + + this.rocket.Speed.Y),
                        new Vector2D(0, 0.04));
                    p.FadeFactor = Util.getRandom(0.985, 0.999);
                    break;

                case 1:
                    p = new FireworkParticle(
                        new Vector2D(this.rocket.Position.X, this.rocket.Position.Y),
                        new Vector2D(Util.getRandom(1.1, 1.6) * Math.cos(2 * Math.PI * FireWork.NUM_EXPLODE_PARTICLES / i),
                                     Util.getRandom(1.1, 1.6) * Math.sin(2 * Math.PI * FireWork.NUM_EXPLODE_PARTICLES / i)),
                        new Vector2D(0.007, 0.01));
                    p.FadeFactor = Util.getRandom(0.98, 0.985);
                    break;

                case 2:
                    p = new FireworkParticle(
                        new Vector2D(this.rocket.Position.X, this.rocket.Position.Y),
                        new Vector2D(Util.getRandom(0.5, 1.6) * Math.cos(2 * Math.PI * FireWork.NUM_EXPLODE_PARTICLES / i),
                                     Util.getRandom(-0.2, 1.6) * Math.sin(2 * Math.PI * FireWork.NUM_EXPLODE_PARTICLES / i)),
                        new Vector2D(0, 0.04));
                    p.FadeFactor = Util.getRandom(0.985, 0.999);
                    break;

                default:
                    throw new Error('unsupported explodeIdx: ' + explodeIdx.toString());
            }

            p.SetColor(this.rocket.ColorR, this.rocket.ColorG, this.rocket.ColorB, this.rocket.ColorA);
            p.SetRenderFunction(explodeParticleRenderer);
            p.FadeFactor = Util.getRandom(0.98, 0.985)
            this.explodeParticles.push(p);
        }

        this.exploded = true;
    }

}

class RocketParticleRenderer implements IParticle2DDraw
{
    public displayParticle = (ctx: CanvasRenderingContext2D, particle: Particle2D): void =>
    {
        ctx.fillStyle = particle.GetColorRGBAString();

        ctx.beginPath();
        ctx.arc(particle.Position.X - 2, particle.Position.Y - 2, 4, 0, 2 * Math.PI, false);

        let cg: CanvasGradient = ctx.createRadialGradient(particle.Position.X - 2, particle.Position.Y - 2, 0.01,
            particle.Position.X - 2, particle.Position.Y - 2, 4);
        cg.addColorStop(0, "rgb(255, 255, 255)");
        cg.addColorStop(1, particle.GetColorRGBAString());
        ctx.fillStyle = cg;
        ctx.fill();
    }
}

class SmokeParticleRenderer implements IParticle2DDraw
{
    public displayParticle = (ctx: CanvasRenderingContext2D, particle: Particle2D): void =>
    {
        ctx.fillStyle = particle.GetColorRGBAString();
        ctx.fillRect(particle.Position.X - 2, particle.Position.Y - 2, 5, 5);
    }
}

class ExplodeParticleRenderer implements IParticle2DDraw
{
    public displayParticle = (ctx: CanvasRenderingContext2D, particle: Particle2D): void =>
    {
        ctx.fillStyle = particle.GetColorRGBAString();
        ctx.fillRect(particle.Position.X - 1, particle.Position.Y - 1, 3, 3);
    }
}
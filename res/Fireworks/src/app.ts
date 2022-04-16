
import { GraphicsLoop } from "./GraphicsLoop.js"
import { FireWork } from "./Firework.js"
import { Util } from "./Util.js"

let cvs: HTMLCanvasElement;
let myApp: MyApp;

class MyApp extends GraphicsLoop
{
    private fireworks: Array<FireWork>;
    private MAX_NUM_OF_FIREWORKS = 7;
    private explodeFlashIntensity: number;
    private showExplosionFlash: boolean;

    constructor(htmlCvsElem: HTMLCanvasElement)
    {
        super(htmlCvsElem);
        this.setBackground("#000000");

        this.fireworks = new Array<FireWork>();
        this.fireworks.push(new FireWork(htmlCvsElem.width, htmlCvsElem.height));
        this.explodeFlashIntensity = 0;
        this.showExplosionFlash = true;

        this.FpsDrawFpsValue = true;
        this.FpsFillStyle = '#444444';
    }

    protected update = (time: number): void =>
    {
        for (let i = 0; i < this.fireworks.length; i++)
        {
            if (this.fireworks[i].isActive())
            {
                if (this.fireworks[i].update())
                {
                    this.explodeFlashIntensity += 10;
                }
            }
            else
            {
                this.fireworks.splice(i, 1);
            }
        }

        if ((this.fireworks.length < this.MAX_NUM_OF_FIREWORKS) && Math.random() < 0.02)
        {
            this.fireworks.push(new FireWork(this.canvasMain.width, this.canvasMain.height));
        }
    }

    protected draw = (ctx: CanvasRenderingContext2D, time: number): void =>
    {
        ctx.save();

        if (this.showExplosionFlash && (this.explodeFlashIntensity > 0))
        {
            ctx.save();
            ctx.fillStyle = Util.buildRgba(0x88, 0x88, 0x88, Math.min(1, this.explodeFlashIntensity * 0.05));
            ctx.fillRect(0, 0, this.getCanvasWidth(), this.getCanvasHeight());
            this.explodeFlashIntensity--;
        }

        for (let i = 0; i < this.fireworks.length; i++)
        {
            this.fireworks[i].display(ctx);
        }
        ctx.restore();
    }
}

window.addEventListener("load", () =>
{
    cvs = <HTMLCanvasElement>document.getElementById('cvs');
    myApp = new MyApp(cvs);

    myApp.setMaxAllowedFps(80);
    myApp.startMainLoop();
});

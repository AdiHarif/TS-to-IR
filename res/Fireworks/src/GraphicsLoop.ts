
/**
 * @class Fps
 */
class Fps
{
    /** Counts the number of processed frames each second */
    private fpsFrameCounterPerSecond: number = 0;
    /** Absolute time of last FPS measurement. Used to update the calculated FPS each second. */
    private fpsFrameTimeLastMeasurement: number = 0;
    /** Absolute time of last update call */
    private fpsLastUpdateTimeAbsolute: number = 0;

    /** Measured and caluclated frame per seconds of last measurement */
    private fpsCurrentFpsValue: number = 0;

    /** Stores the maximum allowed FPS value. Can be used to limit the actual frames per second to slow everything down */
    private fpsMaxAllowed: number;

    /**
     * @constructor
     */
    constructor()
    {
        this.fpsMaxAllowed = 120;
    }

    /**
     * Starts the measurement and calculation of the fps.
     */
    public start = (startTime: number): void =>
    {
        this.fpsFrameCounterPerSecond = 0;
        this.fpsFrameTimeLastMeasurement = startTime;
        this.fpsCurrentFpsValue = 0;
        this.fpsLastUpdateTimeAbsolute = startTime;
    }

    /**
     * Update function that shall be called each frame.
     * Measures and calculates the timings and fps.
     * @return false if a maximum FPS limit is set and it is not enough time elapsed to handle the next frame,
     *         otherwise true
     */
    public update = (time: number): boolean =>
    {
        /* limit maximum FPS if enabled */
        if (this.fpsMaxAllowed != 0)
        {
            /* If not enough time has passed for current frame, return immediately without update values below! */
            if (time < this.fpsLastUpdateTimeAbsolute + (1000 / this.fpsMaxAllowed))
            {
                return false;
            }
        }

        /* calculate fps */
        if (time > this.fpsFrameTimeLastMeasurement + 1000)
        {
            this.fpsCurrentFpsValue = this.fpsFrameCounterPerSecond;
            this.fpsFrameCounterPerSecond = 0;
            this.fpsFrameTimeLastMeasurement = time;
        }

        /* update frame counter and store absolute time of this call */
        this.fpsFrameCounterPerSecond++;
        this.fpsLastUpdateTimeAbsolute = time;

        return true;
    }

    public getCurrentFps = (): number =>
    {
        return this.fpsCurrentFpsValue;
    }

    public getMaxAllowedFps = (): number =>
    {
        return this.fpsMaxAllowed;
    }

    public setMaxAllowedFps = (maxAllowedFps: number): void =>
    {
        this.fpsMaxAllowed = maxAllowedFps;
    }
}

/**
 * @class GraphicsLoop
 */
export class GraphicsLoop
{
    /** HTML main canvas element */
    protected canvasMain: HTMLCanvasElement;
    /** HTML double-buffered canvas element */
    private canvasDoubleBuffer?: HTMLCanvasElement;

    /** main canvas rendering object */
    protected ctxMain: CanvasRenderingContext2D;
    /** double-buffered canvas rendering object */
    private ctxDoubleBuffer?: CanvasRenderingContext2D;

    /** flag to store if double-buffering is used */
    private useDoubleBuffering: boolean;

    private ctxUser: CanvasRenderingContext2D;

    private animationFrameId: number = 0;
    private loopRunning: boolean;
    private stopLoopRequested: boolean;

    /** absolute time of previous frame */
    private lastFrameTimeAbsolute: number = 0;
    private fps: Fps;

    /** flag to store if the FPS value shall be drawn into the right corner of the canvas */
    public FpsDrawFpsValue: boolean;
    public FpsFillStyle: string | CanvasGradient | CanvasPattern;

    private backgroundColor: string = "";

    constructor(htmlCvsElem: HTMLCanvasElement, useDoubleBuffer: boolean = true)
    {
        this.canvasMain = htmlCvsElem;
        this.ctxMain = this.canvasMain.getContext("2d")!;
        this.useDoubleBuffering = useDoubleBuffer;

        if (this.useDoubleBuffering)
        {
            this.canvasDoubleBuffer = document.createElement('canvas');
            this.canvasDoubleBuffer.width = this.canvasMain.width;
            this.canvasDoubleBuffer.height = this.canvasMain.height;
            this.ctxDoubleBuffer = this.canvasDoubleBuffer.getContext("2d")!;
            this.ctxUser = this.ctxDoubleBuffer;
        }
        else
        {
            this.ctxUser = this.ctxMain;
        }

        this.fps = new Fps();
        this.FpsDrawFpsValue = false;
        this.FpsFillStyle = '#000000';

        this.loopRunning = false;
        this.stopLoopRequested = false;
    }

    protected update = (time: number): void =>
    {

    }

    protected draw = (ctx: CanvasRenderingContext2D, time: number): void =>
    {

    }

    public startMainLoop = (): void =>
    {
        if (!this.loopRunning)
        {
            window.requestAnimationFrame((time: number) => 
            {
                this.fps.start(time);

                this.lastFrameTimeAbsolute = time;
                this.loopRunning = true;
                this.animationFrameId = window.requestAnimationFrame(this.mainLoop);
            });
        }
    }

    public stopMainLoop = (): void =>
    {
        if (this.loopRunning)
        {
            this.stopLoopRequested = true;
        }
    }

    private mainLoop = (time: number): void =>
    {
        let deltaFrameTime: number;

        deltaFrameTime = time - this.lastFrameTimeAbsolute;

        if (this.fps.update(time) === false)
        {
            requestAnimationFrame(this.mainLoop);
            return;
        }

        /* call update function */
        this.update(deltaFrameTime);

        /* prepare canvas and background, call draw function */
        if (this.backgroundColor)
        {
            let fillStyleBackup = this.ctxUser.fillStyle;
            this.ctxUser.fillStyle = this.backgroundColor;
            this.ctxUser.fillRect(0, 0, this.canvasMain.width, this.canvasMain.height);
            this.ctxUser.fillStyle = fillStyleBackup;
        }
        else
        {
            this.ctxUser.clearRect(0, 0, this.canvasMain.width, this.canvasMain.height);
        }
        this.draw(this.ctxUser, deltaFrameTime);

        if (this.useDoubleBuffering)
        {
            this.ctxMain.drawImage(this.canvasDoubleBuffer!, 0, 0);
        }

        /* draw FPS value if enabled */
        if (this.FpsDrawFpsValue)
        {
            this.drawFPS();
        }

        /* save absolute time of this frame */
        this.lastFrameTimeAbsolute = time;

        /* prepare next loop and pause */
        if (this.stopLoopRequested)
        {
            window.cancelAnimationFrame(this.animationFrameId);
            this.stopLoopRequested = false;
            this.loopRunning = false;
        }
        else
        {
            this.animationFrameId = window.requestAnimationFrame(this.mainLoop);
        }
    }

    private drawFPS = (): void =>
    {
        this.ctxMain.save();

        this.ctxMain.font = '10px Arial';
        this.ctxMain.fillStyle = this.FpsFillStyle;
        this.ctxMain.fillText("FPS: " + this.fps.getCurrentFps(), this.canvasMain.width - 60, 20);

        this.ctxMain.restore();
    }

    public getCurrentFps = (): number =>
    {
        return this.fps.getCurrentFps();
    }

    public setMaxAllowedFps = (fps: number): void =>
    {
        this.fps.setMaxAllowedFps(fps);
    }

    public setBackground = (color: string): void =>
    {
        this.backgroundColor = color;
    }

    public getCanvasWidth = (): number =>
    {
        return this.canvasMain.width;
    }

    public getCanvasHeight = (): number =>
    {
        return this.canvasMain.height;
    }
}




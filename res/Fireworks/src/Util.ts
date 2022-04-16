export class Util
{
    /**
     * Returns a random number between min (inclusive) and max (exclusive)
     * Taken from: https://stackoverflow.com/questions/1527803/generating-random-whole-numbers-in-javascript-in-a-specific-range
     */
    static getRandom = (min: number, max: number): number =>
    {
        return Math.random() * (max - min) + min;
    }

    /**
     * Returns a random integer between min (inclusive) and max (inclusive).
     * The value is no lower than min (or the next integer greater than min
     * if min isn't an integer) and no greater than max (or the next integer
     * lower than max if max isn't an integer).
     * Using Math.round() will give you a non-uniform distribution!
     * Taken from: https://stackoverflow.com/questions/1527803/generating-random-whole-numbers-in-javascript-in-a-specific-range
     */
    static getRandomInt = (min: number, max: number): number =>
    {
        let minInt: number = Math.ceil(min);
        let maxInt: number = Math.floor(max);
        return Math.floor(Math.random() * (maxInt - minInt + 1)) + minInt;
    }

    /**
     * Builds an rgba string
     */
    static buildRgba = (r: number, g: number, b: number, a?: number) : string => 
    {
        if (a === undefined)
        {
            return "rgba(" + r.toString() + ", " + g.toString() + ", " + b.toString() + ", 1)";
        }
        else
        {
            return "rgba(" + r.toString() + ", " + g.toString() + ", " + b.toString() + ", " + a.toString() + ")";
        }
    }

    static mapValRange = (value: number, sourceStart: number, sourceEnd: number, destStart: number, destEnd: number) : number =>
    {
        let ratio: number = (value - sourceStart) / (sourceEnd - sourceStart);
        let result: number = ratio * (destEnd - destStart) + destStart;
        return result;
    }
}
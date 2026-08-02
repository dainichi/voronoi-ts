import { Point } from "../Point.js";

export class Border {
    start: Point | null = null;
    end: Point | null = null;

    constructor(
        public readonly siteA: Point, //left when standing at start looking towards end
        public readonly siteB: Point
    ) {}

    toString(): string {
        return `Border[${this.siteA} - ${this.siteB}] start=${this.start} end=${this.end}`;
    }
}
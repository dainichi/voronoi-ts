import { Point } from "./Point.js";

export class Border<T> {
    start: Point | null = null;
    end: Point | null = null;

    constructor(
        public readonly siteA: T, //left when standing at start looking towards end
        public readonly siteB: T
    ) {}

    toString(): string {
        return `Border[${this.siteA} - ${this.siteB}] start=${this.start} end=${this.end}`;
    }
}
import { Point } from "./Point.js";

export class Edge {
    start: Point | null = null;
    end: Point | null = null;

    constructor(
        public readonly leftSite: Point,
        public readonly rightSite: Point
    ) {}

    toString(): string {
        return `Edge[${this.leftSite} - ${this.rightSite}] start=${this.start} end=${this.end}`;
    }
}
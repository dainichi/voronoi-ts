import { Point } from "../Point.js";
import { Edge } from "./Edge.js";
import { Vertex } from "./Vertex.js";

export class Border {
    start: Point | null = null;
    end: Point | null = null;

    constructor(
        public readonly siteA: Edge | Vertex, //left when standing at start looking towards end
        public readonly siteB: Edge | Vertex
    ) {}

    toString(): string {
        return `Border[${this.siteA} - ${this.siteB}] start=${this.start} end=${this.end}`;
    }
}
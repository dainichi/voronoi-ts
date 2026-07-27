import { Point } from "../Point.js";
import { Edge } from "./Edge.js";
import { Vertex } from "./Vertex.js";

export class CellBorder {
    constructor(
        public readonly leftSite: Edge | Vertex,
        public readonly rightSite: Edge | Vertex,
        public readonly start: Point,
        public end?: Point
    ) {}

    toString(): string {
        return `VoronoiEdge[${this.leftSite} - ${this.rightSite}] start=${this.start} end=${this.end}`;
    }
}
import { Point } from "../Point.js";
import { PolygonEdge } from "./PolygonEdge.js";
import { Vertex } from "./Vertex.js";

export class CellBorder {
    constructor(
        public readonly leftSite: PolygonEdge | Vertex,
        public readonly rightSite: PolygonEdge | Vertex,
        public readonly start: Point,
        public end?: Point
    ) {}

    toString(): string {
        return `VoronoiEdge[${this.leftSite} - ${this.rightSite}] start=${this.start} end=${this.end}`;
    }
}
import { Point } from "../Point.js";
import { PolygonEdge } from "./PolygonEdge.js";

export class VoronoiEdge {
    constructor(
        public readonly leftSite: PolygonEdge,
        public readonly rightSite: PolygonEdge,
        public readonly start: Point,
        public end?: Point
    ) {}

    toString(): string {
        return `VoronoiEdge[${this.leftSite} - ${this.rightSite}] start=${this.start} end=${this.end}`;
    }
}
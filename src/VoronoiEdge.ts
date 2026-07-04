import { Point } from "./Point.js";
import { PolygonEdge } from "./PolygonEdge.js";

export class VoronoiEdge {
    start: Point | null = null;
    end: Point | null = null;

    constructor(
        public readonly leftSite: PolygonEdge,
        public readonly rightSite: PolygonEdge
    ) {}

    toString(): string {
        return `VoronoiEdge[${this.leftSite} - ${this.rightSite}] start=${this.start} end=${this.end}`;
    }
}
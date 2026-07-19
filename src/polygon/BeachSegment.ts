import { CellBorder } from "./CellBorder.js";
import { CircleEvent } from "../sweep/CircleEvent.js";
import { PolygonEdge } from "./PolygonEdge.js";
import { Vertex } from "./Vertex.js";

export class BeachSegment {
    circleEvent?: CircleEvent<BeachSegment>;

    constructor(
        public readonly site: PolygonEdge | Vertex,
        public prev?: BeachSegment,
        public rightEdge?: CellBorder,
        public next?: BeachSegment
    ) {}

    toString(): string {
        return `BeachSegment(${this.site})`;
    }
}
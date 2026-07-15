import { VoronoiEdge } from "./VoronoiEdge.js";
import { CircleEvent } from "../sweep/CircleEvent.js";
import { PolygonEdge } from "./PolygonEdge.js";

export class Arc {
    circleEvent?: CircleEvent<Arc>;

    constructor(
        public readonly edge: PolygonEdge,
        public prev?: Arc,
        public rightEdge?: VoronoiEdge,
        public next?: Arc
    ) {}

    toString(): string {
        return `Arc(${this.edge})`;
    }
}
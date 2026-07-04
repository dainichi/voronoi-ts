import { VoronoiEdge } from "./VoronoiEdge.js";
import { CircleEvent } from "./CircleEvent.js";
import { PolygonEdge } from "./PolygonEdge.js";

export class Arc {
    prev?: Arc;
    next?: Arc;
    circleEvent?: CircleEvent;
    rightEdge?: VoronoiEdge;

    constructor(public readonly edge: PolygonEdge) {}

    toString(): string {
        return `Arc(${this.edge})`;
    }
}
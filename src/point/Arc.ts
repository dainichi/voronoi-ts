import { Edge } from "./Edge.js";
import { Point } from "../Point.js";
import { CircleEvent } from "./CircleEvent.js";

export class Arc {
    prev?: Arc;
    next?: Arc;
    circleEvent?: CircleEvent;
    rightEdge?: Edge;

    edgeOrientation = false;

    constructor(public readonly site: Point) {}

    toString(): string {
        return `Arc(${this.site})`;
    }
}
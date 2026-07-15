import { Edge } from "./Edge.js";
import { Point } from "../Point.js";
import { CircleEvent } from "../sweep/CircleEvent.js";

export class Arc {
    circleEvent?: CircleEvent<Arc>;

    constructor(public readonly site: Point, public prev?:Arc, 
        public next?: Arc, public rightEdge?: Edge, public edgeOrientation = false) {}

    toString(): string {
        return `Arc(${this.site})`;
    }
}
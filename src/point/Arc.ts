import { Border } from "./Border.js";
import { Point } from "../Point.js";
import { CircleEvent } from "../sweep/CircleEvent.js";
import { BorderEnd } from "./BorderEnd.js";

export class Arc {
    circleEvent?: CircleEvent<Arc>;

    constructor(public readonly site: Point, public prev?:Arc, 
        public next?: Arc, public borderEndOnRight? : BorderEnd) {}

    toString(): string {
        return `Arc(${this.site})`;
    }
}
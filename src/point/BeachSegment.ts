import { Point } from "../Point.js";
import { CircleEvent } from "../sweep/CircleEvent.js";
import { BorderEnd } from "../BorderEnd.js";

export class BeachSegment {
    circleEvent?: CircleEvent<BeachSegment>;

    constructor(public readonly site: Point, public prev?:BeachSegment, 
        public next?: BeachSegment, public borderEndOnRight? : BorderEnd<Point>) {}

    toString(): string {
        return `Arc(${this.site})`;
    }
}
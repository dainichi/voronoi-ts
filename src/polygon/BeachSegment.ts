import { CircleEvent } from "../sweep/CircleEvent.js";
import { Edge } from "./Edge.js";
import { Vertex } from "./Vertex.js";
import { BorderEnd } from "./BorderEnd.js";

export class BeachSegment {
    circleEvent?: CircleEvent<BeachSegment>;
    prev?: BeachSegment;
    next?: BeachSegment;

    constructor(
        public readonly site: Edge | Vertex,
        public borderEndOnRight?: BorderEnd,
    ) {}

    toString(): string {
        return `BeachSegment(${this.site})`;
    }

    clearEvent(): void {
        if (this.circleEvent) this.circleEvent.valid = false;
        this.circleEvent = undefined;
    }

    remove(): void {
        if(this.prev) this.prev.next = this.next;
        if(this.next) this.next.prev = this.prev;
    }
}
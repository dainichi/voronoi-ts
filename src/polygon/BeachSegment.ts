import { CellBorder } from "./CellBorder.js";
import { CircleEvent } from "../sweep/CircleEvent.js";
import { Edge } from "./Edge.js";
import { Vertex } from "./Vertex.js";

export class BeachSegment {
    circleEvent?: CircleEvent<BeachSegment>;
    prev?: BeachSegment;
    next?: BeachSegment;

    constructor(
        public readonly site: Edge | Vertex,
        public rightBorder?: CellBorder,
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
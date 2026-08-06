import { CircleEvent } from "./sweep/CircleEvent.js";
import { Edge } from "./polygon/Edge.js";
import { Vertex } from "./polygon/Vertex.js";
import { BorderEnd } from "./BorderEnd.js";

export class BeachSegment<T> {
    circleEvent?: CircleEvent<BeachSegment<T>>;
    prev?: BeachSegment<T>;
    next?: BeachSegment<T>;

    constructor(
        public readonly site: T,
        public borderEndOnRight?: BorderEnd<T>,
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

export function link<T>(a: BeachSegment<T>, b: BeachSegment<T>): void {
    a.next = b;
    b.prev = a;
}

export function replace<T>(old: BeachSegment<T>, first: BeachSegment<T>, last: BeachSegment<T>): void {
    if (old.prev) link(old.prev, first); else first.prev = undefined;
    if (old.next) link(last, old.next); else last.next = undefined;
}
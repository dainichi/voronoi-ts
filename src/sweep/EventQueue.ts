import { CircleEvent } from "./CircleEvent.js";

export interface SweepEvent {
    readonly x: number;
    readonly y: number;
}

export function compareSweepEvents(a: SweepEvent, b: SweepEvent): number {
    if (a.y !== b.y) return b.y - a.y;
    return a.x - b.x;
}

export class EventQueue<E extends SweepEvent> {
    private readonly events: E[] = [];

    get length(): number {
        return this.events.length;
    }

    peek(): E | undefined {
        return this.events[0];
    }

    push(ev: E): void {
        let i = 0;
        while (i < this.events.length && compareSweepEvents(this.events[i], ev) <= 0) {
            i++;
        }
        this.events.splice(i, 0, ev);
    }

    shift(): E | undefined {
        return this.events.shift();
    }
}

export function purgeStaleCircleEvents<E extends SweepEvent>(queue: EventQueue<E>): void {
    while (queue.length > 0) {
        const next = queue.peek();
        if (!(next instanceof CircleEvent)) break;
        if (next.valid && next.arc.circleEvent === next) break;
        queue.shift();
    }
}

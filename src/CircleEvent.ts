import { Point } from "./Point.js";
import { Arc } from "./Arc.js";
import { Event } from "./Event.js";

export class CircleEvent extends Event {
    valid = true;

    constructor(
        public readonly center: Point,
        public readonly radius: number,
        public readonly arc: Arc
    ) {
        super(center.x, center.y - radius);
    }

    toString(): string {
        return `CircleEvent(center=${this.center}, r=${this.radius}, yEvent=${this.y})`;
    }
}
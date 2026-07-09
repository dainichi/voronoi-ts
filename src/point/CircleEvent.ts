import { Point } from "../Point.js";
import { Arc } from "./Arc.js";

export class CircleEvent {
    readonly x: number;
    readonly y: number;
    valid = true;

    constructor(
        public readonly center: Point,
        public readonly radius: number,
        public readonly arc: Arc
    ) {
        this.x = center.x;
        this.y = center.y - radius;
    }

    toString(): string {
        return `CircleEvent(center=${this.center}, r=${this.radius}, yEvent=${this.y})`;
    }
}
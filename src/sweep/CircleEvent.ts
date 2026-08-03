import { Point } from "../Point.js";

export class CircleEvent<A> {
    readonly x: number;
    readonly y: number;
    valid = true;

    constructor(
        public readonly center: Point,
        public readonly radius: number,
        public readonly beachSegment: A,
    ) {
        this.x = center.x;
        this.y = center.y - radius;
    }

    toString(): string {
        return `CircleEvent(center=${this.center}, r=${this.radius}, yEvent=${this.y})`;
    }
}

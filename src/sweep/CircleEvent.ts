import { Circle } from "../Geometry.js";
import { Point } from "../Point.js";

export class CircleEvent<A> {
    readonly x: number;
    readonly y: number;
    valid = true;

    constructor(
        public readonly circle: Circle,
        public readonly beachSegment: A,
    ) {
        this.x = circle.center.x;
        this.y = circle.center.y - circle.radius;
    }

    toString(): string {
        return `CircleEvent(center=${this.circle.center}, r=${this.circle.radius}, yEvent=${this.y})`;
    }
}

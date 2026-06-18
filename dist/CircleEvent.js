import { Event } from "./Event.js";
export class CircleEvent extends Event {
    center;
    radius;
    arc;
    valid = true;
    constructor(center, radius, arc) {
        super(center.x, center.y - radius);
        this.center = center;
        this.radius = radius;
        this.arc = arc;
    }
    toString() {
        return `CircleEvent(center=${this.center}, r=${this.radius}, yEvent=${this.y})`;
    }
}

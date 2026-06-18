import { Point } from "./Point.js";
import { Event } from "./Event.js";

export class SiteEvent extends Event {
    constructor(public readonly site: Point) {
        super(site.x, site.y);
    }

    toString(): string {
        return `SiteEvent(${this.site})`;
    }
}
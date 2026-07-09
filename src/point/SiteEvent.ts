import { Point } from "../Point.js";

export class SiteEvent {
    readonly x: number;
    readonly y: number;

    constructor(public readonly site: Point) {
        this.x = site.x;
        this.y = site.y;
    }

    toString(): string {
        return `SiteEvent(${this.site})`;
    }
}
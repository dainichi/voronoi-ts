import { Event } from "./Event.js";
export class SiteEvent extends Event {
    site;
    constructor(site) {
        super(site.x, site.y);
        this.site = site;
    }
    toString() {
        return `SiteEvent(${this.site})`;
    }
}

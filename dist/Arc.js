export class Arc {
    site;
    prev;
    next;
    circleEvent;
    rightEdge;
    edgeOrientation = false;
    constructor(site) {
        this.site = site;
    }
    toString() {
        return `Arc(${this.site})`;
    }
}

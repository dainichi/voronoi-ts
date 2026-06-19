import { Point } from "./Point.js";
import { Edge } from "./Edge.js";
import { Arc } from "./Arc.js";
import { SiteEvent } from "./SiteEvent.js";
import { CircleEvent } from "./CircleEvent.js";
import { Geometry } from "./Geometry.js";
export class Voronoi {
    static EPS = 1e-9;
    pq = [];
    beachRoot = null;
    centers = new Set();
    edges = new Set();
    sweepY = Infinity;
    addEvent(ev) {
        let i = 0;
        while (i < this.pq.length && this.pq[i].compareTo(ev) <= 0) {
            i++;
        }
        this.pq.splice(i, 0, ev);
    }
    constructor(sites) {
        for (const s of sites) {
            this.addEvent(new SiteEvent(s));
        }
    }
    pollEvent() {
        return this.pq.shift();
    }
    checkCircle(sweepY, a, b, c) {
        if (!a || !b || !c)
            return;
        const A = a.site, B = b.site, C = c.site;
        const area = (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x);
        if (Math.abs(area) < Voronoi.EPS)
            return;
        const d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
        if (Math.abs(d) < Voronoi.EPS)
            return;
        const ux = ((A.x * A.x + A.y * A.y) * (B.y - C.y) +
            (B.x * B.x + B.y * B.y) * (C.y - A.y) +
            (C.x * C.x + C.y * C.y) * (A.y - B.y)) /
            d;
        const uy = ((A.x * A.x + A.y * A.y) * (C.x - B.x) +
            (B.x * B.x + B.y * B.y) * (A.x - C.x) +
            (C.x * C.x + C.y * C.y) * (B.x - A.x)) /
            d;
        const center = new Point(ux, uy);
        const r = Math.hypot(center.x - A.x, center.y - A.y);
        const eventY = center.y - r;
        if (eventY >= (sweepY ?? this.sweepY) - Voronoi.EPS)
            return;
        const ce = new CircleEvent(center, r, b);
        b.circleEvent = ce;
        this.addEvent(ce);
        console.log("Circle event added", ce, "for arc", b);
    }
    handleCircleEvent(ce) {
        const a = ce.arc;
        const vertex = ce.center;
        if (a.prev == null || a.prev.rightEdge == null) {
            console.warn("Circle event with null prev arc", ce);
        }
        else {
            if (a.prev?.edgeOrientation)
                a.prev.rightEdge.end = vertex;
            else if (a.prev)
                a.prev.rightEdge.start = vertex;
        }
        if (a.rightEdge == null) {
            console.warn("Circle event with null right edge", ce);
        }
        else {
            if (a.edgeOrientation)
                a.rightEdge.start = vertex;
            else
                a.rightEdge.end = vertex;
        }
        const left = a.prev;
        const right = a.next;
        left.next = right;
        right.prev = left;
        const e = new Edge(right.site, left.site);
        e.start = vertex;
        this.edges.add(e);
        left.rightEdge = e;
        left.edgeOrientation = true;
        if (left.circleEvent) {
            left.circleEvent.valid = false;
            left.circleEvent = undefined;
        }
        if (right.circleEvent) {
            right.circleEvent.valid = false;
            right.circleEvent = undefined;
        }
        this.checkCircle(ce.y, left.prev, left, right);
        this.checkCircle(ce.y, left, right, right.next);
    }
    step() {
        if (this.pq.length === 0) {
            this.sweepY = -Infinity;
            return false;
        }
        const ev = this.pollEvent();
        console.log("Event polled", ev);
        if (!ev)
            return false;
        this.sweepY = ev.y;
        if (ev instanceof SiteEvent) {
            this.handleSiteEvent(ev);
            console.log("Site handled", ev, "beachline", this.beachlineToString(this.beachRoot));
        }
        else if (ev instanceof CircleEvent) {
            const ce = ev;
            const arc = ce.arc;
            this.centers.add(ce.center);
            this.handleCircleEvent(ce);
            console.log("Circle handled", ce, arc);
        }
        while (this.pq.length > 0 &&
            this.pq[0] instanceof CircleEvent &&
            (!this.pq[0].valid ||
                this.pq[0].arc.circleEvent !== this.pq[0])) {
            this.pollEvent();
        }
        return true;
    }
    compute() {
        while (this.step()) { }
    }
    static findArcAbove(head, p) {
        let a = head;
        while (a.next) {
            if (p.x < Geometry.parabolaIntersection(a.site, a.next.site, p.y)) {
                return a;
            }
            a = a.next;
        }
        return a;
    }
    handleSiteEvent(ev) {
        const p = ev.site;
        if (!this.beachRoot) {
            this.beachRoot = new Arc(p);
            return;
        }
        const arc = Voronoi.findArcAbove(this.beachRoot, p);
        if (arc.circleEvent) {
            arc.circleEvent.valid = false;
            arc.circleEvent = undefined;
        }
        const left = new Arc(arc.site);
        const center = new Arc(p);
        const right = new Arc(arc.site);
        left.prev = arc.prev;
        if (left.prev)
            left.prev.next = left;
        left.next = center;
        center.prev = left;
        center.next = right;
        right.prev = center;
        right.next = arc.next;
        if (right.next)
            right.next.prev = right;
        if (arc === this.beachRoot)
            this.beachRoot = left;
        const e = new Edge(p, arc.site);
        this.edges.add(e);
        left.rightEdge = e;
        left.edgeOrientation = true;
        center.rightEdge = e;
        center.edgeOrientation = false;
        right.rightEdge = arc.rightEdge;
        right.edgeOrientation = arc.edgeOrientation;
        this.checkCircle(p.y, left.prev, left, center);
        this.checkCircle(p.y, center, right, right.next);
    }
    beachlineToString(head) {
        if (!head)
            return "[]";
        let sb = "[";
        let a = head;
        let first = true;
        while (a) {
            if (!first)
                sb += " -> ";
            sb += `(${a.site.x.toFixed(3)}, ${a.site.y.toFixed(3)})`;
            first = false;
            a = a.next ?? null;
        }
        sb += "]";
        return sb;
    }
}

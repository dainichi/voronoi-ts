import { Point } from "../Point.js";
import { Edge } from "./Edge.js";
import { Arc } from "./Arc.js";
import { SiteEvent } from "./SiteEvent.js";
import { CircleEvent } from "./CircleEvent.js";
import type { Event } from "./Event.js";
import { parabolaIntersection } from "../Geometry.js";

function compareEvents(a: Event, b: Event): number {
  if(a.y !== b.y) return b.y - a.y;
  return a.x - b.x;
}
export class Voronoi {
  private static readonly EPS = 1e-9;

  readonly pq: Event[] = [];

  beachRoot: Arc | null = null;
  centers = new Set<Point>();
  edges = new Set<Edge>();

  sweepY = Infinity;

  private addEvent(ev: Event): void {
    let i = 0;
    while (i < this.pq.length && compareEvents(this.pq[i], ev) <= 0) {
      i++;
    }
    this.pq.splice(i, 0, ev);
  }

  constructor(sites: Point[]) {
    for (const s of sites) {
      this.addEvent(new SiteEvent(s));
    }
  }

  private checkCircle(sweepY: number, a?: Arc, b?: Arc, c?: Arc): void {
    if (!a || !b || !c) return;

    const A = a.site,
      B = b.site,
      C = c.site;

    const area = (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x);

    if (area > -Voronoi.EPS) return;

    const d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));

    if (Math.abs(d) < Voronoi.EPS) return;

    const ux =
      ((A.x * A.x + A.y * A.y) * (B.y - C.y) +
        (B.x * B.x + B.y * B.y) * (C.y - A.y) +
        (C.x * C.x + C.y * C.y) * (A.y - B.y)) /
      d;

    const uy =
      ((A.x * A.x + A.y * A.y) * (C.x - B.x) +
        (B.x * B.x + B.y * B.y) * (A.x - C.x) +
        (C.x * C.x + C.y * C.y) * (B.x - A.x)) /
      d;

    const center = new Point(ux, uy);
    const r = Math.hypot(center.x - A.x, center.y - A.y);

    if (center.y - r > sweepY + Voronoi.EPS) return;

    const ce = new CircleEvent(center, r, b);
    b.circleEvent = ce;

    this.addEvent(ce);
  }

  private handleCircleEvent(ce: CircleEvent): void {
    const a = ce.arc;
    const vertex = ce.center;

    if (a.prev?.rightEdge) {
      if (a.prev?.edgeOrientation) a.prev.rightEdge.end = vertex;
      else a.prev.rightEdge.start = vertex;
    }

    if (a.rightEdge) {
      if (a.edgeOrientation) a.rightEdge.end = vertex;
      else a.rightEdge.start = vertex;
    }

    const left = a.prev!;
    const right = a.next!;

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

  step(): boolean {
    if (this.pq.length === 0) {
      this.sweepY = -Infinity;
      return false;
    }

    const ev = this.pq.shift();

    if (!ev) return false;

    this.sweepY = ev.y;

    if (ev instanceof SiteEvent) {
      this.handleSiteEvent(ev);
    } else if (ev instanceof CircleEvent) {
      this.centers.add(ev.center);
      this.handleCircleEvent(ev);
    }
    while (
      this.pq.length > 0 &&
      this.pq[0] instanceof CircleEvent &&
      (!(this.pq[0] as CircleEvent).valid ||
        (this.pq[0] as CircleEvent).arc.circleEvent !== this.pq[0])
    ) {
      this.pq.shift();
    }
    return true;
  }

  compute(): void {
    while (this.step()) {}
  }

  private findArcAbove(head: Arc, p: Point): Arc {
    let a: Arc = head;

    while (a.next) {
      if (p.x < parabolaIntersection(a.site, a.next.site, p.y)) {
        return a;
      }
      a = a.next;
    }
    return a;
  }

  private handleSiteEvent(ev: SiteEvent): void {
    const p = ev.site;

    if (!this.beachRoot) {
      this.beachRoot = new Arc(p);
      return;
    }

    const arc = this.findArcAbove(this.beachRoot, p);

    if (arc.circleEvent) {
      arc.circleEvent.valid = false;
      arc.circleEvent = undefined;
    }

    if (arc.site.y === p.y) {
      const newArc = new Arc(p);
      newArc.prev = arc;
      newArc.next = arc.next;
      if (arc.next) arc.next.prev = newArc;
      arc.next = newArc;

      const e = new Edge(p, arc.site);
      this.edges.add(e);

      newArc.rightEdge = arc.rightEdge;
      newArc.edgeOrientation = arc.edgeOrientation;
      
      arc.rightEdge = e;
      arc.edgeOrientation = true;

      this.checkCircle(p.y, arc.prev, arc, newArc);
      this.checkCircle(p.y, arc, newArc, newArc.next);
      return;
    }


    const left = new Arc(arc.site);
    const center = new Arc(p);
    const right = new Arc(arc.site);

    left.prev = arc.prev;
    if (left.prev) left.prev.next = left;

    left.next = center;
    center.prev = left;

    center.next = right;
    right.prev = center;

    right.next = arc.next;
    if (right.next) right.next.prev = right;

    if (arc === this.beachRoot) this.beachRoot = left;

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
}

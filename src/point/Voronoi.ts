import { Point } from "../Point.js";
import { Edge } from "./Edge.js";
import { Arc } from "./Arc.js";
import { SiteEvent } from "./SiteEvent.js";
import { CircleEvent } from "../sweep/CircleEvent.js";
import { EventQueue, purgeStaleCircleEvents } from "../sweep/EventQueue.js";
import type { Event } from "./Event.js";
import { parabolaIntersection } from "../Geometry.js";

export class Voronoi {
  private static readonly EPS = 1e-9;

  readonly pq = new EventQueue<Event>();

  beachRoot: Arc | null = null;
  centers = new Set<Point>();
  edges = new Set<Edge>();

  sweepY = Infinity;

  constructor(sites: Point[]) {
    for (const s of sites) {
      this.pq.push(new SiteEvent(s));
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

    this.pq.push(ce);
  }

  private handleCircleEvent(ce: CircleEvent<Arc>): void {
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
    purgeStaleCircleEvents(this.pq);
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
      const newArc = new Arc(p, arc, arc.next, arc.rightEdge, arc.edgeOrientation);

      if (arc.next) arc.next.prev = newArc;
      arc.next = newArc;

      const e = new Edge(p, arc.site);
      this.edges.add(e);

      arc.rightEdge = e;
      arc.edgeOrientation = true;

      this.checkCircle(p.y, arc.prev, arc, newArc);
      this.checkCircle(p.y, arc, newArc, newArc.next);
      return;
    }

    const e = new Edge(p, arc.site);
    this.edges.add(e);

    const left = new Arc(arc.site, arc.prev, undefined, e, true);
    const center = new Arc(p, left, undefined, e, false);
    const right = new Arc(arc.site, center, arc.next, arc.rightEdge, arc.edgeOrientation);

    if (left.prev) left.prev.next = left;

    left.next = center;
    center.next = right;

    if (right.next) right.next.prev = right;

    if (arc === this.beachRoot) this.beachRoot = left;

    this.checkCircle(p.y, left.prev, left, center);
    this.checkCircle(p.y, center, right, right.next);
  }
}

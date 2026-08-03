import { Point } from "../Point.js";
import { Border as GenericBorder } from "../Border.js";
import { BeachSegment } from "./BeachSegment.js";
import { SiteEvent } from "./SiteEvent.js";
import { CircleEvent } from "../sweep/CircleEvent.js";
import { EventQueue, purgeStaleCircleEvents } from "../sweep/EventQueue.js";
import type { Event } from "./Event.js";
import { parabolaIntersection } from "../Geometry.js";
import { BorderEnd as GenericBorderEnd} from "../BorderEnd.js";

type Border = GenericBorder<Point>;
type BorderEnd = GenericBorderEnd<Point>;
const Border = GenericBorder;
const BorderEnd = GenericBorderEnd;
export class Voronoi {
  private static readonly EPS = 1e-9;

  readonly pq = new EventQueue<Event>();

  beachRoot: BeachSegment | null = null;
  centers = new Set<{ center: Point; radius: number }>();
  edges = new Set<Border>();

  sweepY = Infinity;

  constructor(sites: Point[]) {
    for (const s of sites) {
      this.pq.push(new SiteEvent(s));
    }
  }

  private checkCircle(sweepY: number, a?: BeachSegment, b?: BeachSegment, c?: BeachSegment): void {
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

  private handleCircleEvent(ce: CircleEvent<BeachSegment>): void {
    const a = ce.arc;
    const vertex = ce.center;

    if (a.prev?.borderEndOnRight) 
      a.prev.borderEndOnRight.fix(vertex);
    

    if (a.borderEndOnRight) 
      a.borderEndOnRight.fix(vertex);

    const left = a.prev!;
    const right = a.next!;

    left.next = right;
    right.prev = left;

    const e = new Border(right.site, left.site);
    e.start = vertex;
    this.edges.add(e);

    left.borderEndOnRight = new BorderEnd(e, true);

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
      this.centers.add({ center: ev.center, radius: ev.radius });
      this.handleCircleEvent(ev);
    }
    purgeStaleCircleEvents(this.pq);
    return true;
  }

  compute(): void {
    while (this.step()) {}
  }

  private findArcAbove(head: BeachSegment, p: Point): BeachSegment {
    let a: BeachSegment = head;

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
      this.beachRoot = new BeachSegment(p);
      return;
    }

    const above = this.findArcAbove(this.beachRoot, p);

    if (above.circleEvent) {
      above.circleEvent.valid = false;
      above.circleEvent = undefined;
    }

    if (above.site.y === p.y) {
      const newArc = new BeachSegment(p, above, above.next, above.borderEndOnRight);

      if (above.next) above.next.prev = newArc;
      above.next = newArc;

      const e = new Border(p, above.site);
      this.edges.add(e);

      above.borderEndOnRight = new BorderEnd(e, true);

      this.checkCircle(p.y, above.prev, above, newArc);
      this.checkCircle(p.y, above, newArc, newArc.next);
      return;
    }

    const e = new Border(p, above.site);
    this.edges.add(e);

    const left = new BeachSegment(above.site, above.prev, undefined, new BorderEnd (e,true));
    const center = new BeachSegment(p, left, undefined, new BorderEnd(e, false));
    const right = new BeachSegment(above.site, center, above.next, above.borderEndOnRight);

    if (left.prev) left.prev.next = left;

    left.next = center;
    center.next = right;

    if (right.next) right.next.prev = right;

    if (above === this.beachRoot) this.beachRoot = left;

    this.checkCircle(p.y, left.prev, left, center);
    this.checkCircle(p.y, center, right, right.next);
  }
}

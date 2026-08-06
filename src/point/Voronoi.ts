import { Point } from "../Point.js";
import { Border as GenericBorder } from "../Border.js";
import { BeachSegment as GenericBeachSegment, link, replace} from "../BeachSegment.js";
import { SiteEvent } from "./SiteEvent.js";
import { CircleEvent } from "../sweep/CircleEvent.js";
import { EventQueue, purgeStaleCircleEvents } from "../sweep/EventQueue.js";
import { Circle, clockwiseCircumcircle, parabolaIntersection } from "../Geometry.js";
import { BorderEnd as GenericBorderEnd} from "../BorderEnd.js";

type Border = GenericBorder<Point>;
type BorderEnd = GenericBorderEnd<Point>;
const Border = GenericBorder;
const BorderEnd = GenericBorderEnd;
export type BeachSegment = GenericBeachSegment<Point>;
const BeachSegment = GenericBeachSegment<Point>;
type Event = SiteEvent | CircleEvent<BeachSegment>;
export class Voronoi {
  private static readonly EPS = 1e-9;

  readonly pq = new EventQueue<Event>();

  beachRoot: BeachSegment | null = null;
  circles = new Set<Circle>();
  edges = new Set<Border>();

  sweepY = Infinity;

  constructor(sites: Point[]) {
    for (const s of sites) {
      this.pq.push(new SiteEvent(s));
    }
  }

  private checkCircle(b?: BeachSegment): void {
    if (!b || !b.prev || !b.next) return;
    
    const A = b.prev.site,
      B = b.site,
      C = b.next.site;

const circle = clockwiseCircumcircle(A, B, C, Voronoi.EPS);
  if (!circle) return;
    const ce = new CircleEvent(circle,  b);
    b.circleEvent = ce;

    this.pq.push(ce);
  }

  private handleCircleEvent(ce: CircleEvent<BeachSegment>): void {
    const a = ce.beachSegment;
    const vertex = ce.circle.center;

    a.prev!.borderEndOnRight!.fix(vertex);
    a.borderEndOnRight!.fix(vertex);

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

    this.checkCircle(left);
    this.checkCircle(right);
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
      this.circles.add(ev.circle);
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

    above.clearEvent();

    if (above.site.y === p.y) {
      const newArc = new BeachSegment(p, above.borderEndOnRight);

replace(above, above, newArc);
link(above, newArc);

      const e = new Border(p, above.site);
      this.edges.add(e);

      above.borderEndOnRight = new BorderEnd(e, true);

      this.checkCircle(above);
      this.checkCircle(newArc);
      return;
    }

    const e = new Border(p, above.site);
    this.edges.add(e);

    const left = new BeachSegment(above.site, new BorderEnd (e,true));
    const center = new BeachSegment(p, new BorderEnd(e, false));
    const right = new BeachSegment(above.site, above.borderEndOnRight);

replace(above, left, right);
link(left, center);
link(center, right);

    if (above === this.beachRoot) this.beachRoot = left;

    this.checkCircle(left);
    this.checkCircle(right);
  }
}

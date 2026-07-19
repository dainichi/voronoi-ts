import { Point } from "../Point.js";
import { CellBorder } from "./CellBorder.js";
import { BeachSegment } from "./BeachSegment.js";
import { Vertex } from "./Vertex.js";
import { PolygonEdge } from "./PolygonEdge.js";
import { VertexEvent } from "./VertexEvent.js";
import { CircleEvent } from "../sweep/CircleEvent.js";
import { EventQueue, purgeStaleCircleEvents } from "../sweep/EventQueue.js";
import type { Event } from "./Event.js";
import { beachSegmentIntersection, solve3x3 } from "../Geometry.js";

export class Voronoi {
  private static readonly EPS = 1e-9;

  readonly pq = new EventQueue<Event>();

  beach: { head: BeachSegment, tail: BeachSegment } | null = null;

  centers = new Set<Point>();
  borders = new Set<CellBorder>();

  sweepY = Infinity;

  //wire up edges and vertices and add vertex events to the queue
  constructor(sites: Point[]) {
    const vertices = sites.map((site) => new Vertex(site));

    for (let i = 0; i < vertices.length; i++) {
      const start = vertices[i];
      const end = vertices[(i + 1) % vertices.length];
      const edge = new PolygonEdge(start, end);

      start.nextEdge = edge;
      end.prevEdge = edge;
    }

    for (const vertex of vertices) {
      this.pq.push(new VertexEvent(vertex));
    }
  }

  private checkCircle(a?: BeachSegment, b?: BeachSegment, c?: BeachSegment): void {
    if (a && b && c && a.site instanceof PolygonEdge &&
      b.site instanceof PolygonEdge && c.site instanceof PolygonEdge) {
      const [x, y, r] = solve3x3([a.site.matRow, b.site.matRow, c.site.matRow]);

      const ce = new CircleEvent(new Point(x, y), r, b);

      b.circleEvent = ce;

      this.pq.push(ce);
    } else if (a && b && c && b.site instanceof PolygonEdge &&
      c.site instanceof PolygonEdge && b.site.end === a.site) {
      let [cdx, cdy] = [c.site.start.p.y - c.site.end.p.y, c.site.end.p.x - c.site.start.p.x];
      let [ba, bb, ,] = b.site.matRow;
      let [ca, cb, ,] = c.site.matRow;
      const r = ((c.site.start.p.x - b.site.end.p.x) * cdx + (c.site.start.p.y - b.site.end.p.y) * cdy) /
        ((ba - ca) * cdx + (bb - cb) * cdy);
      const x = a.site.p.x + r * ba;
      const y = a.site.p.y + r * bb;
      const ce = new CircleEvent(new Point(x, y), r, b);
      b.circleEvent = ce;

      this.pq.push(ce);

    } else if (a && b && c && a.site instanceof PolygonEdge &&
      c.site instanceof PolygonEdge &&
      a.site.start === b.site && c.site.end === b.site) {
      console.log("non-convex vertex, no circle event")
    } else if (a && b && c && b.site instanceof PolygonEdge &&
      c.site instanceof PolygonEdge && a.site instanceof Vertex) {
      const px = a.site.p.x;
      const py = a.site.p.y;

      const [a1, b1, , c1] = b.site.matRow;
      const [a2, b2, , c2] = c.site.matRow;

      const A = a1 - a2;
      const B = b1 - b2;
      const C = c1 - c2;

      // direction along the line
      const vx = -B;
      const vy = A;

      let x0: number;
      let y0: number;

      if (Math.abs(A) > 1e-12) {
        y0 = 0;
        x0 = C / A;
      } else {
        x0 = 0;
        y0 = C / B;
      }

      const dx = x0 - px;
      const dy = y0 - py;

      // r = a1*x+b1*y-c1
      const r0 = a1 * x0 + b1 * y0 - c1;
      const rv = a1 * vx + b1 * vy;

      const qa = vx * vx + vy * vy - rv * rv;
      const qb = 2 * (dx * vx + dy * vy - r0 * rv);
      const qc = dx * dx + dy * dy - r0 * r0;

      const disc = qb * qb - 4 * qa * qc;

      const sqrt = Math.sqrt(Math.max(0, disc));

      const t = (-qb + sqrt) / (2 * qa)
      const x = x0 + t * vx;
      const y = y0 + t * vy;
      const r = r0 + t * rv;

      const ce = new CircleEvent(new Point(x, y), r, b);
      b.circleEvent = ce;

      this.pq.push(ce);
    } else if (a && b && c && a.site instanceof PolygonEdge
      && b.site instanceof PolygonEdge && b.site.start === c.site) {
      let [aa, ab,,ac] = a.site.matRow;
      let [ba, bb] = b.site.matRow;
      const r = (ac - c.site.p.x * aa - c.site.p.y * ab) / (ba * aa + bb * ab - 1);
      const x = c.site.p.x + r * ba;
      const y = c.site.p.y + r * bb;

      const ce = new CircleEvent(new Point(x, y), r, b);
      b.circleEvent = ce;
      this.pq.push(ce);
    } else if (a && b && c && a.site instanceof PolygonEdge
      && c.site instanceof PolygonEdge
      && a.site.start == b.site) {
      let [aa, ab] = a.site.matRow;
      let [ca, cb, , cc] = c.site.matRow;
      const r = (cc - b.site.p.x * ca - b.site.p.y * cb) / (aa * ca + ab * cb - 1);
      const x = b.site.p.x + r * aa;
      const y = b.site.p.y + r * ab;

      const ce = new CircleEvent(new Point(x, y), r, b);
      b.circleEvent = ce;
      this.pq.push(ce);

    } else {
      console.log("not supported")
    }
  }

  private handleCircleEvent(ce: CircleEvent<BeachSegment>): void {
    const a = ce.arc;
    const vertex = ce.center;

    if (a.prev?.rightEdge) {
      a.prev.rightEdge.end = vertex;
    }
    if (a.rightEdge) {
      a.rightEdge.end = vertex;
    }


    const left = a.prev!;
    const right = a.next!;

    /*     if (!(right.site instanceof PolygonEdge) || !(left.site instanceof PolygonEdge)) {
          console.log("not supported");
          return;
        }
     */
    left.next = right;
    right.prev = left;

    const e = new CellBorder(right.site, left.site, vertex);
    this.borders.add(e);

    left.rightEdge = e;

    if (left.circleEvent) {
      left.circleEvent.valid = false;
      left.circleEvent = undefined;
    }
    if (right.circleEvent) {
      right.circleEvent.valid = false;
      right.circleEvent = undefined;
    }

    this.checkCircle(left.prev, left, right);
    this.checkCircle(left, right, right.next);
  }

  step(): boolean {
    if (this.pq.length === 0) {
      this.sweepY = -Infinity;
      return false;
    }

    const ev = this.pq.shift();

    if (!ev) return false;

    this.sweepY = ev.y;

    if (ev instanceof VertexEvent) {
      this.handleVertexEvent(ev);
    } else if (ev instanceof CircleEvent) {
      this.centers.add(ev.center);
      this.handleCircleEvent(ev);
    }
    purgeStaleCircleEvents(this.pq);
    return true;
  }

  compute(): void {
    while (this.step()) { }
  }

  private handleVertexEvent(ev: VertexEvent): void {
    const v = ev.vertex;

    if (!this.beach) {
      let a1 = new BeachSegment(v.nextEdge!, undefined,
        new CellBorder(v.prevEdge!, v.nextEdge!, v.p));
      let a2 = new BeachSegment(v.prevEdge!, a1);
      a1.next = a2;
      this.borders.add(a1.rightEdge!);
      this.beach = { head: a1, tail: a2 };
      return;
    }

    if (v.prevEdge === this.beach.head.site && v.nextEdge === this.beach.tail.site) {
      console.log("Vertex event at both ends of the beachline");
      if (this.beach.head.rightEdge) {
        this.beach.head.rightEdge.end = v.p;
      }
      return;
    } else if (v.prevEdge === this.beach.head.site) {
      if ((v.prevEdge.end.p.x - v.prevEdge.start.p.x) * (v.nextEdge!.end.p.y - v.nextEdge!.start.p.y)
        - (v.prevEdge.end.p.y - v.prevEdge.start.p.y) * (v.nextEdge!.end.p.x - v.nextEdge!.start.p.x) > 0) {
        console.log("Convex vertex event at the head of the beachline");
        let a = new BeachSegment(v.nextEdge!);
        a.next = this.beach.head;
        this.beach.head.prev = a;
        this.beach.head = a;
        a.rightEdge = new CellBorder(v.prevEdge!, v.nextEdge!, v.p);
        this.borders.add(a.rightEdge);
        this.checkCircle(a, a.next, a.next.next);
        return;
      } else {
        console.log("Concave vertex event at the head of the beachline");
        let a = new BeachSegment(v.nextEdge!);
        let b = new BeachSegment(v);
        a.next = b;
        b.next = this.beach.head;
        this.beach.head.prev = b;
        b.prev = a;
        this.beach.head = a;
        a.rightEdge = new CellBorder(v, v.nextEdge!, v.p);
        b.rightEdge = new CellBorder(v.prevEdge!, v, v.p);
        this.borders.add(a.rightEdge);
        this.borders.add(b.rightEdge);
        this.checkCircle(b, b.next, b.next.next);
        return;
      }
    } else if (v.nextEdge === this.beach.tail.site) {
      console.log("Vertex event at the tail of the beachline");
      let a = new BeachSegment(v.prevEdge!);
      a.prev = this.beach.tail;
      this.beach.tail.next = a;
      this.beach.tail.rightEdge = new CellBorder(v.prevEdge!, v.nextEdge!, v.p);
      this.borders.add(this.beach.tail.rightEdge);
      this.beach.tail = a;
      this.checkCircle(a.prev.prev, a.prev, a);
      return;
    } else {
      throw new Error("Vertex event not at the ends of the beachline, not supported yet");
    }
  }
}

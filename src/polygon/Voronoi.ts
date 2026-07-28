import { Point } from "../Point.js";
export type VoronoiCenter = { center: Point; radius: number };
import { CellBorder } from "./CellBorder.js";
import { BeachSegment } from "./BeachSegment.js";
import { Vertex } from "./Vertex.js";
import { Edge } from "./Edge.js";
import { VertexEvent } from "./VertexEvent.js";
import { CircleEvent } from "../sweep/CircleEvent.js";
import { EventQueue, purgeStaleCircleEvents } from "../sweep/EventQueue.js";
import type { Event } from "./Event.js";
import {
  beachSegmentIntersection,
  circleCenterAtEdgeEnd,
  circleCenterOnLine,
  solve3x3,
} from "../Geometry.js";
import { assert } from "../utils.js";

export class Voronoi {
  private static readonly EPS = 1e-9;

  readonly pq = new EventQueue<Event>();

  beachSections: { head: BeachSegment; tail: BeachSegment }[] = [];

  centers = new Set<VoronoiCenter>();
  borders = new Set<CellBorder>();

  sweepY = Infinity;

  //wire up edges and vertices and add vertex events to the queue
  constructor(sites: Point[]) {
    const vertices = sites.map((site) => new Vertex(site));

    for (let i = 0; i < vertices.length; i++) {
      const start = vertices[i];
      const end = vertices[(i + 1) % vertices.length];
      const edge = new Edge(start, end);

      start.nextEdge = edge;
      end.prevEdge = edge;
    }

    for (const vertex of vertices) {
      this.pq.push(new VertexEvent(vertex));
    }
  }

  private emitCircle(x: number, y: number, r: number, b: BeachSegment): void {
    if (r <= 0) {
      console.log(
        `skipping circle event with r=${r.toFixed(4)} at (${x.toFixed(3)}, ${y.toFixed(3)}) for ${b}`,
      );
      return;
    }
    const ce = new CircleEvent(new Point(x, y), r, b);
    b.circleEvent = ce;
    this.pq.push(ce);
  }

  private addNewCellBorder(
    left: Edge | Vertex,
    right: Edge | Vertex,
    start: Point,
    end?: Point,
  ) {
    const a = new CellBorder(left, right, start, end);
    this.borders.add(a);
    return a;
  }

  private checkCircle1V2E(
    as: Vertex,
    bs: Edge,
    cs: Edge,
    b: BeachSegment,
  ): void {
    // angle bisector of bs and cs as the line
    const [a1, b1, , c1] = bs.matRow;
    const [a2, b2, , c2] = cs.matRow;
    const A = a1 - a2,
      B = b1 - b2,
      C = c1 - c2;
    // direction along the line
    const vx = -B,
      vy = A;
    const x0 = Math.abs(A) > 1e-12 ? C / A : 0;
    const y0 = Math.abs(A) > 1e-12 ? 0 : C / B;
    const circles = circleCenterOnLine(
      x0,
      y0,
      vx,
      vy,
      as.p.x,
      as.p.y,
      a1 * x0 + b1 * y0 - c1,
      a1 * vx + b1 * vy,
    ).filter(([x, y, r]) => as.inCone(x, y));
    if (circles.length != 1)
      console.log("1V2E " + circles.length + " circle events");
    circles.forEach(([x, y, r]) => this.emitCircle(x, y, r, b));
  }

  private checkCircle1E2V(
    as: Edge,
    bs: Vertex,
    cs: Vertex,
    b: BeachSegment,
  ): void {
    // general (E, V, V): perpendicular bisector of bs and cs as the line
    const [aa, ab, , ad] = as.matRow;
    const A = 2 * (cs.p.x - bs.p.x),
      B = 2 * (cs.p.y - bs.p.y);
    const C =
      cs.p.x * cs.p.x + cs.p.y * cs.p.y - bs.p.x * bs.p.x - bs.p.y * bs.p.y;
    const vx = -B,
      vy = A;
    const x0 = Math.abs(A) > 1e-12 ? C / A : 0;
    const y0 = Math.abs(A) > 1e-12 ? 0 : C / B;
    const circles = circleCenterOnLine(
      x0,
      y0,
      vx,
      vy,
      bs.p.x,
      bs.p.y,
      aa * x0 + ab * y0 - ad,
      aa * vx + ab * vy,
    ).filter(([x, y, r]) => bs.inCone(x, y) && cs.inCone(x, y));
    if (circles.length != 1)
      console.log("1E2V " + circles.length + " circle events");
    circles.forEach(([x, y, r]) => this.emitCircle(x, y, r, b));
  }

  private checkCircle(b?: BeachSegment): void {
    if (!b || !b.prev || !b.next) return;
    const as = b.prev.site,
      bs = b.site,
      cs = b.next.site;

    if (as instanceof Edge && bs instanceof Edge && cs instanceof Edge) {
      const [x, y, r] = solve3x3([as.matRow, bs.matRow, cs.matRow]);
      this.emitCircle(x, y, r, b);
    } else if (
      as instanceof Vertex &&
      bs instanceof Edge &&
      cs instanceof Edge
    ) {
      if (bs.end === as) {
        const [x, y, r] = circleCenterAtEdgeEnd(as, bs, cs);
        this.emitCircle(x, y, r, b);
      } else {
        this.checkCircle1V2E(as, bs, cs, b);
      }
    } else if (
      as instanceof Edge &&
      bs instanceof Vertex &&
      cs instanceof Edge
    ) {
      if (as.start === bs && cs.end === bs) {
        //reflex vertex between its own edges: no circle event
      } else if (as.start === bs) {
        const [x, y, r] = circleCenterAtEdgeEnd(bs, as, cs);
        this.emitCircle(x, y, r, b);
      } else if (cs.end === bs) {
        const [x, y, r] = circleCenterAtEdgeEnd(bs, cs, as);
        this.emitCircle(x, y, r, b);
      } else {
        this.checkCircle1V2E(bs, as, cs, b);
      }
    } else if (
      as instanceof Edge &&
      bs instanceof Edge &&
      cs instanceof Vertex
    ) {
      if (bs.start === cs) {
        const [x, y, r] = circleCenterAtEdgeEnd(cs, bs, as);
        this.emitCircle(x, y, r, b);
      } else {
        this.checkCircle1V2E(cs, as, bs, b);
      }
    } else if (
      as instanceof Vertex &&
      bs instanceof Edge &&
      cs instanceof Vertex
    ) {
      if (bs.start === as || bs.end === as) {
        const [ba, bb] = bs.matRow;
        const cx = cs.p.x - as.p.x,
          cy = cs.p.y - as.p.y;
        const denom = 2 * (cx * ba + cy * bb);
        if (Math.abs(denom) > 1e-12) {
          const r = (cx * cx + cy * cy) / denom;
          this.emitCircle(as.p.x + r * ba, as.p.y + r * bb, r, b);
        }
      } else if (bs.start === cs) {
        const [ba, bb] = bs.matRow;
        const ax = as.p.x - cs.p.x,
          ay = as.p.y - cs.p.y;
        const denom = 2 * (ax * ba + ay * bb);
        if (Math.abs(denom) > 1e-12) {
          const r = (ax * ax + ay * ay) / denom;
          this.emitCircle(cs.p.x + r * ba, cs.p.y + r * bb, r, b);
        }
      } else {
        this.checkCircle1E2V(bs, as, cs, b);
      }
    } else if (
      as instanceof Vertex &&
      bs instanceof Vertex &&
      cs instanceof Edge
    ) {
      if (cs.end === bs) {
        const [ca, cb] = cs.matRow;
        const ax = as.p.x - bs.p.x,
          ay = as.p.y - bs.p.y;
        const denom = 2 * (ax * ca + ay * cb);
        if (Math.abs(denom) > 1e-12) {
          const r = (ax * ax + ay * ay) / denom;
          this.emitCircle(bs.p.x + r * ca, bs.p.y + r * cb, r, b);
        }
      } else {
        this.checkCircle1E2V(cs, as, bs, b);
      }
    } else if (
      as instanceof Edge &&
      bs instanceof Vertex &&
      cs instanceof Vertex
    ) {
      if (as.start === bs) {
        const [aa, ab] = as.matRow;
        const cx = cs.p.x - bs.p.x,
          cy = cs.p.y - bs.p.y;
        const denom = 2 * (cx * aa + cy * ab);
        if (Math.abs(denom) > 1e-12) {
          const r = (cx * cx + cy * cy) / denom;
          this.emitCircle(bs.p.x + r * aa, bs.p.y + r * ab, r, b);
        }
      } else {
        this.checkCircle1E2V(as, bs, cs, b);
      }
    } else if (
      as instanceof Vertex &&
      bs instanceof Vertex &&
      cs instanceof Vertex
    ) {
      const area =
        (bs.p.x - as.p.x) * (cs.p.y - as.p.y) -
        (bs.p.y - as.p.y) * (cs.p.x - as.p.x);
      if (area > -Voronoi.EPS) return;
      const d =
        2 *
        (as.p.x * (bs.p.y - cs.p.y) +
          bs.p.x * (cs.p.y - as.p.y) +
          cs.p.x * (as.p.y - bs.p.y));
      if (Math.abs(d) < Voronoi.EPS) return;
      const ux =
        ((as.p.x * as.p.x + as.p.y * as.p.y) * (bs.p.y - cs.p.y) +
          (bs.p.x * bs.p.x + bs.p.y * bs.p.y) * (cs.p.y - as.p.y) +
          (cs.p.x * cs.p.x + cs.p.y * cs.p.y) * (as.p.y - bs.p.y)) /
        d;
      const uy =
        ((as.p.x * as.p.x + as.p.y * as.p.y) * (cs.p.x - bs.p.x) +
          (bs.p.x * bs.p.x + bs.p.y * bs.p.y) * (as.p.x - cs.p.x) +
          (cs.p.x * cs.p.x + cs.p.y * cs.p.y) * (bs.p.x - as.p.x)) /
        d;
      const r = Math.hypot(ux - as.p.x, uy - as.p.y);
      this.emitCircle(ux, uy, r, b);
    } else {
      console.log(
        "Circle event not supported for " +
          as.toString() +
          " " +
          bs.toString() +
          " " +
          cs.toString(),
      );
    }
  }

  private handleCircleEvent(ce: CircleEvent<BeachSegment>): void {
    const a = ce.arc;
    const c = ce.center;

    const left = a.prev!;
    const right = a.next!;

    left.rightBorder!.end = c;
    a.rightBorder!.end = c;

    a.remove();

    left.rightBorder = this.addNewCellBorder(right.site, left.site, c);

    left.clearEvent();
    right.clearEvent();

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

    if (ev instanceof VertexEvent) {
      this.handleVertexEvent(ev);
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

  private initSection(v: Vertex): { head: BeachSegment; tail: BeachSegment } {
    const a1 = new BeachSegment(v.nextEdge!);
    a1.rightBorder = this.addNewCellBorder(v.prevEdge!, v.nextEdge!, v.p);
    const a2 = new BeachSegment(v.prevEdge!);
    a1.next = a2;
    a2.prev = a1;
    return { head: a1, tail: a2 };
  }

  private handleVertexEvent(ev: VertexEvent): void {
    const v = ev.vertex;
    if (this.beachSections.length === 0) {
      this.beachSections.push(this.initSection(v));
    } else {
      const hs = this.beachSections.find((s) => s.head.site === v.prevEdge);
      const ts = this.beachSections.find((s) => s.tail.site === v.nextEdge);

      if (hs && ts) {
        if (hs === ts) {
          console.log("Vertex event at both ends of the same beach section");
          if (hs.head.rightBorder) hs.head.rightBorder.end = v.p;
          this.beachSections.splice(this.beachSections.indexOf(hs), 1);
        } else {
          //Merge: ts.tail (nextEdge) meets hs.head (prevEdge) at v.p
          const oldTail = ts.tail;
          assert(!v.isConvex(), "convex merge?");
          const a = new BeachSegment(v);
          oldTail.rightBorder = this.addNewCellBorder(v, v.nextEdge!, v.p);
          a.rightBorder = this.addNewCellBorder(v.prevEdge!, v, v.p);
          oldTail.next = a;
          a.prev = oldTail;
          a.next = hs.head;
          hs.head.prev = a;
          ts.tail = hs.tail;
          this.beachSections.splice(this.beachSections.indexOf(hs), 1);
          this.checkCircle(oldTail);
          this.checkCircle(a);
          this.checkCircle(hs.head);
        }
      } else if (hs) {
        if (v.isConvex()) {
          const oldHead = hs.head;
          this.addToFront(hs, v.nextEdge!, v.p);
          this.checkCircle(oldHead);
        } else {
          const oldHead = hs.head;
          this.addToFront(hs, v, v.p);
          this.addToFront(hs, v.nextEdge!, v.p);
          this.checkCircle(oldHead);
        }
      } else if (ts) {
        if (v.isConvex()) {
          const oldTail = ts.tail;
          this.addToEnd(ts, v.prevEdge!, v.p);
          this.checkCircle(oldTail);
        } else {
          const oldTail = ts.tail;
          this.addToEnd(ts, v, v.p);
          this.addToEnd(ts, v.prevEdge!, v.p);
          this.checkCircle(oldTail);
        }
      } else {
        const above = this.findArcAboveOrAddSection(v);
        if (above) {
          //split aboveSec into two sections at V.x:
          // Left: [..., arcAbove, V_left?, prevEdge] (arcAbove stays, new tail = prevEdge)
          // Right: [nextEdge, V_right?, arcAbove_copy, ...] (new head = nextEdge, arcAbove_copy inherits old next)
          const { arc: arcAbove, sec: aboveSec } = above;
          const oldNext = arcAbove.next;
          const oldRightBorder = arcAbove.rightBorder;

          arcAbove.clearEvent();

          //arcAbove_copy: same site, inherits old right connection
          const arcCopy = new BeachSegment(arcAbove.site, oldRightBorder);
          arcCopy.next = oldNext;
          if (oldNext) oldNext.prev = arcCopy;

          assert(!v.isConvex(), "independent convex vertex on sweep line?");

          const newSec = {head: arcCopy, tail: arcAbove === aboveSec.tail ? arcCopy : aboveSec.tail}

          aboveSec.tail = arcAbove;

          const idx = this.beachSections.indexOf(aboveSec);
          this.beachSections.splice(idx + 1, 0, newSec);

          const [lx, ly] = beachSegmentIntersection(arcAbove.site, v, v.p.y);

          this.addToEnd(aboveSec, v, new Point(lx, ly));
          this.addToEnd(aboveSec, v.prevEdge!, v.p);

          this.addToFront(newSec, v, new Point(lx, ly));
          this.addToFront(newSec, v.nextEdge!, v.p);


          this.checkCircle(arcAbove);
          this.checkCircle(arcAbove.next);
          this.checkCircle(arcCopy.prev);
          this.checkCircle(arcCopy);
        }
      }
    }
  }

  addToEnd(
    ts: { head: BeachSegment; tail: BeachSegment },
    beachSite: Edge | Vertex,
    startPoint: Point,
  ) {
    const bs = new BeachSegment(beachSite);
    const border = this.addNewCellBorder(ts.tail.site, beachSite, startPoint);
    ts.tail.rightBorder = border;
    bs.prev = ts.tail;
    ts.tail.next = bs;
    ts.tail = bs;
  }

  addToFront(
    hs: { head: BeachSegment; tail: BeachSegment },
    beachSite: Edge | Vertex,
    startPoint: Point,
  ): void {
    const bs = new BeachSegment(
      beachSite,
      this.addNewCellBorder(hs.head.site, beachSite, startPoint),
    );
    bs.next = hs.head;
    hs.head.prev = bs;
    hs.head = bs;
  }

  private findArcAboveOrAddSection(v: Vertex): {
    arc: BeachSegment;
    sec: { head: BeachSegment; tail: BeachSegment };
  } | null {
    const x = v.p.x;
    const sweepY = v.p.y;
    for (let i = 0; i < this.beachSections.length; i++) {
      const sec = this.beachSections[i];
      let arc: BeachSegment = sec.head;
      if (arc.site instanceof Vertex)
        throw Error("Start of beach lines should be Edge");
      if (
        x <
        arc.site.start.p.x +
          ((sweepY - arc.site.start.p.y) *
            (arc.site.end.p.x - arc.site.start.p.x)) /
            (arc.site.end.p.y - arc.site.start.p.y)
      ) {
        const newSec = this.initSection(v);
        this.beachSections.splice(i, 0, newSec);
        return null;
      }
      while (arc) {
        if (!arc.next) {
          if (arc.site instanceof Vertex)
            throw Error("End of beach lines should be Edge");
          if (
            x <
            arc.site.start.p.x +
              ((sweepY - arc.site.start.p.y) *
                (arc.site.end.p.x - arc.site.start.p.x)) /
                (arc.site.end.p.y - arc.site.start.p.y)
          )
            return { arc, sec };
          break;
        }
        const [rx] = beachSegmentIntersection(arc.site, arc.next.site, sweepY);
        if (!Number.isFinite(rx) || x <= rx) return { arc, sec };
        arc = arc.next;
      }
    }
    const newSec = this.initSection(v);
    this.beachSections.push(newSec);
    return null;
  }
}

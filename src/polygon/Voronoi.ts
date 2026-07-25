import { Point } from "../Point.js";
export type VoronoiCenter = {center: Point; radius: number};
import { CellBorder } from "./CellBorder.js";
import { BeachSegment } from "./BeachSegment.js";
import { Vertex } from "./Vertex.js";
import { PolygonEdge } from "./PolygonEdge.js";
import { VertexEvent } from "./VertexEvent.js";
import { CircleEvent } from "../sweep/CircleEvent.js";
import { EventQueue, purgeStaleCircleEvents } from "../sweep/EventQueue.js";
import type { Event } from "./Event.js";
import { beachSegmentIntersection, circleCenterAtEdgeEnd, circleCenterOnLine, solve3x3 } from "../Geometry.js";

export class Voronoi {
  private static readonly EPS = 1e-9;

  readonly pq = new EventQueue<Event>();

  beachSections: { head: BeachSegment, tail: BeachSegment }[] = [];

  centers = new Set<VoronoiCenter>();
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

  private emitCircle(x: number, y:number, r:number, b:BeachSegment): void {
    if (r <= 0) {
      console.log(`skipping circle event with r=${r.toFixed(4)} at (${x.toFixed(3)}, ${y.toFixed(3)}) for ${b}`);
      return;
    }
    const ce = new CircleEvent (new Point(x,y), r, b);
    b.circleEvent = ce;
    this.pq.push(ce);
  }

  private checkCircle(a?: BeachSegment, b?: BeachSegment, c?: BeachSegment): void {
    if (!a || !b || !c) return;
    const as = a.site, bs = b.site, cs = c.site;

    if (as instanceof PolygonEdge && bs instanceof PolygonEdge && cs instanceof PolygonEdge) {
      const [x, y, r] = solve3x3([as.matRow, bs.matRow, cs.matRow]);
      this.emitCircle(x, y, r, b);
    } else if (as instanceof Vertex && bs instanceof PolygonEdge && cs instanceof PolygonEdge) {
      if (bs.end === as) {
        const [x, y, r] = circleCenterAtEdgeEnd(as, bs, cs);
        this.emitCircle(x, y, r, b);
      } else {
        // angle bisector of bs and cs as the line
        const [a1,b1,,c1] = bs.matRow;
        const [a2,b2,,c2] = cs.matRow;
        const A = a1 - a2, B = b1 - b2, C = c1 - c2;
        // direction along the line
        const vx = -B, vy = A;
        const x0 = Math.abs(A) > 1e-12 ? C / A : 0;
        const y0 = Math.abs(A) > 1e-12 ? 0 : C / B;
        const [x, y, r] = circleCenterOnLine(x0,y0,vx,vy,as.p.x,as.p.y,a1*x0+b1*y0-c1,a1*vx+b1*vy);
        this.emitCircle(x, y, r, b);
      }
    } else if (as instanceof PolygonEdge && bs instanceof Vertex && cs instanceof PolygonEdge) {
      if (as.start === bs && cs.end === bs) {
        //reflex vertex between its own edges: no circle event
      } else if (as.start === bs) {
        const [x, y, r] = circleCenterAtEdgeEnd(bs, as, cs);
        this.emitCircle(x, y, r, b);
      } else {
        // general (E,V,E) case: angle bisector of as and cs as the line
        const [a1,b1,,c1] = as.matRow;
        const [a2,b2,,c2] = cs.matRow;
        const A = a1 - a2, B = b1 - b2, C = c1 - c2;
        // direction along the line
        const vx = -B, vy = A;
        const x0 = Math.abs(A) > 1e-12 ? C / A : 0;
        const y0 = Math.abs(A) > 1e-12 ? 0 : C / B;
        const [x, y, r] = circleCenterOnLine(x0,y0,vx,vy,bs.p.x,bs.p.y,a1*x0+b1*y0-c1,a1*vx+b1*vy);
        this.emitCircle(x, y, r, b);
      }
    } else if (as instanceof PolygonEdge && bs instanceof PolygonEdge && cs instanceof Vertex) {
      if (bs.start === cs) {
        const [x, y, r] = circleCenterAtEdgeEnd(cs, bs, as);
        this.emitCircle(x, y, r, b);
      } else {
        // general (E, E, V) case: angle bisector of as and bs as the line
        const [a1,b1,,c1] = as.matRow;
        const [a2,b2,,c2] = bs.matRow;
        const A = a1 - a2, B = b1 - b2, C = c1 - c2;
        // direction along the line
        const vx = -B, vy = A;
        const x0 = Math.abs(A) > 1e-12 ? C / A : 0;
        const y0 = Math.abs(A) > 1e-12 ? 0 : C / B;
        const [x, y, r] = circleCenterOnLine(x0,y0,vx,vy,cs.p.x,cs.p.y,a2*x0+b2*y0-c2,a2*vx+b2*vy);
        this.emitCircle(x, y, r, b);
      }
    } else if (as instanceof Vertex && bs instanceof PolygonEdge && cs instanceof Vertex) {
      if (bs.start === as || bs.end === as) {
        const [ba,bb] = bs.matRow;
        const cx = cs.p.x - as.p.x, cy = cs.p.y - as.p.y;
        const denom = 2 * (cx * ba + cy * bb);
        if (Math.abs(denom) > 1e-12) {
          const r = (cx * cx + cy * cy) / denom;
          this.emitCircle(as.p.x + r * ba, as.p.y + r * bb, r, b);
        }
      } else if (bs.start === cs) {
        const [ba,bb] = bs.matRow;
        const ax = as.p.x - cs.p.x, ay = as.p.y - cs.p.y;
        const denom = 2 * (ax * ba + ay * bb);
        if (Math.abs(denom) > 1e-12) {
          const r = (ax*ax + ay*ay) / denom;
          this.emitCircle(cs.p.x + r*ba, cs.p.y + r * bb, r, b);
        }
      } else {
        // general (V, E, V): perpendicular bisector of as and cs as the line
        const [ba,bb,,bd] = bs.matRow;
        const A = 2 * (cs.p.x - as.p.x), B = 2 * (cs.p.y - as.p.y);
        const C = cs.p.x * cs.p.x + cs.p.y * cs.p.y - as.p.x * as.p.x - as.p.y * as.p.y;
        const vx = -B, vy = A;
        const x0 = Math.abs(A) > 1e-12 ? C / A : 0;
        const y0 = Math.abs(A) > 1e-12 ? 0 : C / B;
        const [x,y,r] = circleCenterOnLine(x0,y0,vx,vy,as.p.x,as.p.y,ba*x0+bb*y0-bd, ba*vx+bb*vy);
      }
    } else if (as instanceof Vertex && bs instanceof Vertex && cs instanceof PolygonEdge) {
      //perpendicular bisector of as and bs as the line
      const [ca,cb,,cd] = cs.matRow;
      const A = 2 * (bs.p.x - as.p.x), B = 2 * (bs.p.y - as.p.y);
      const C = bs.p.x * bs.p.x + bs.p.y * bs.p.y - as.p.x * as.p.x - as.p.y * as.p.y;
      const vx = -B, vy = A;
      const x0 = Math.abs(A) > 1e-12 ? C / A : 0;
      const y0 = Math.abs(A) > 1e-12 ? 0 : C / B;
      const [x,y,r] = circleCenterOnLine(x0,y0,vx,vy,bs.p.x,bs.p.y,ca*x0+cb*y0-cd, ca*vx+cb*vy);
      this.emitCircle(x, y, r, b);
    } else if (as instanceof PolygonEdge && bs instanceof Vertex && cs instanceof Vertex) {
      if (as.start === bs) {
        const [aa,ab] = as.matRow;
        const cx = cs.p.x - bs.p.x, cy = cs.p.y - bs.p.y;
        const denom = 2 * (cx * aa + cy * ab);
        if (Math.abs(denom) > 1e-12) {
          const r = (cx * cx + cy * cy) / denom;
          this.emitCircle(bs.p.x + r * aa, bs.p.y + r * ab, r, b);
        }
      } else {
        // general (E, V, V): perpendicular bisector of bs and cs as the line
        const [aa,ab,,ad] = as.matRow;
        const A = 2 * (cs.p.x - bs.p.x), B = 2 * (cs.p.y - bs.p.y);
        const C = cs.p.x * cs.p.x + cs.p.y * cs.p.y - bs.p.x * bs.p.x - bs.p.y * bs.p.y;
        const vx = -B, vy = A;
        const x0 = Math.abs(A) > 1e-12 ? C / A : 0;
        const y0 = Math.abs(A) > 1e-12 ? 0 : C / B;
        const [x,y,r] = circleCenterOnLine(x0,y0,vx,vy,bs.p.x,bs.p.y,aa*x0+ab*y0-ad, aa*vx+ab*vy);
        this.emitCircle(x, y, r, b);
      }
    } else if (as instanceof Vertex && bs instanceof Vertex && cs instanceof Vertex) {
        const area = (bs.p.x - as.p.x) * (cs.p.y - cs.p.y) - (bs.p.y - as.p.y) * (cs.p.x - as.p.x);
        if (area > -Voronoi.EPS)
            return;
        const d = 2 * (as.p.x * (bs.p.y - cs.p.y) + bs.p.x * (cs.p.y - as.p.y) + cs.p.x * (as.p.y - bs.p.y));
        if (Math.abs(d) < Voronoi.EPS)
            return;
        const ux = ((as.p.x * as.p.x + as.p.y * as.p.y) * (bs.p.y - cs.p.y) +
            (bs.p.x * bs.p.x + bs.p.y * bs.p.y) * (cs.p.y - as.p.y) +
            (cs.p.x * cs.p.x + cs.p.y * cs.p.y) * (as.p.y - bs.p.y)) /
            d;
        const uy = ((as.p.x * as.p.x + as.p.y * as.p.y) * (cs.p.x - bs.p.x) +
            (bs.p.x * bs.p.x + bs.p.y * bs.p.y) * (as.p.x - cs.p.x) +
            (cs.p.x * cs.p.x + cs.p.y * cs.p.y) * (bs.p.x - as.p.x)) /
            d;
        const r = Math.hypot(ux - as.p.x, uy - as.p.y);
        this.emitCircle(ux,uy,r,b);
    } else {
      console.log("Circle event not supported for " + as.toString() + " " + bs.toString() + " " + cs.toString());
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
      this.centers.add({center: ev.center, radius: ev.radius});
      this.handleCircleEvent(ev);
    }
    purgeStaleCircleEvents(this.pq);
    return true;
  }

  compute(): void {
    while (this.step()) { }
  }

  private initSection(v: Vertex): void {
    const a1 = new BeachSegment(v.nextEdge!, undefined,
      new CellBorder(v.prevEdge!, v.nextEdge!, v.p));
    const a2 = new BeachSegment(v.prevEdge!, a1);
    a1.next = a2;
    this.borders.add(a1.rightEdge!);
    this.beachSections.push({ head: a1, tail: a2 });
  }

  private handleVertexEvent(ev: VertexEvent): void {
    const v = ev.vertex;

    if (this.beachSections.length === 0) {
      this.initSection(v);
      return;
    }

    const hs = this.beachSections.find(s => s.head.site === v.prevEdge);
    const ts = this.beachSections.find(s => s.tail.site === v.nextEdge);

    if (hs && ts) {
      if (hs === ts) {
        console.log("Vertex event at both ends of the same beach section");
        if (hs.head.rightEdge) hs.head.rightEdge.end = v.p;
        this.beachSections.splice(this.beachSections.indexOf(hs), 1);
      } else {
        //Merge: ts.tail (nextEdge) meets hs.head (prevEdge) at v.p
        const oldTail = ts.tail;
        if (v.isConvex()) {
          oldTail.rightEdge = new CellBorder(v.prevEdge!, v.nextEdge!, v.p);
          this.borders.add(oldTail.rightEdge);
          oldTail.next = hs.head;
          hs.head.prev = oldTail;
          ts.tail = hs.tail;
          this.beachSections.splice(this.beachSections.indexOf(hs), 1);
          this.checkCircle(oldTail.prev, oldTail, hs.head);
          this.checkCircle(oldTail, hs.head, hs.head.next);
        } else {
          const a = new BeachSegment(v);
          oldTail.rightEdge = new CellBorder(v, v.nextEdge!, v.p);
          a.rightEdge = new CellBorder(v.prevEdge!, v, v.p);
          this.borders.add(oldTail.rightEdge);
          this.borders.add(a.rightEdge);
          oldTail.next = a; a.prev = oldTail;
          a.next = hs.head; hs.head.prev = a;
          ts.tail = hs.tail;
          this.beachSections.splice(this.beachSections.indexOf(hs), 1);
          this.checkCircle(oldTail.prev, oldTail, a);
          this.checkCircle(oldTail, a, hs.head);
          this.checkCircle(a, hs.head, hs.head.next);
        }
      }
      return;
    }

    if (hs) {
      if (v.isConvex()) {
        const a = new BeachSegment(v.nextEdge!);
        a.next = hs.head;
        hs.head.prev = a;
        hs.head = a;
        a.rightEdge = new CellBorder(v.prevEdge!, v.nextEdge!, v.p);
        this.borders.add(a.rightEdge);
        this.checkCircle(a, a.next, a.next.next);
      } else {
        const a = new BeachSegment(v.nextEdge!);
        const b = new BeachSegment(v);
        a.next = b; b.prev = a;
        b.next = hs.head; hs.head.prev = b;
        hs.head = a;
        a.rightEdge = new CellBorder(v, v.nextEdge!, v.p);
        b.rightEdge = new CellBorder(v.prevEdge!, v, v.p);
        this.borders.add(a.rightEdge);
        this.borders.add(b.rightEdge);
        this.checkCircle(b, b.next, b.next.next);
      }
      return;
    }

    if (ts) {
      if (v.isConvex()) {
        const a = new BeachSegment(v.prevEdge!);
        a.prev = ts.tail;
        ts.tail.next = a;
        ts.tail.rightEdge = new CellBorder(v.prevEdge!, v.nextEdge!, v.p);
        this.borders.add(ts.tail.rightEdge);
        ts.tail = a;
        this.checkCircle(a.prev.prev, a.prev, a);
      } else {
        const tail = ts.tail;
        const a = new BeachSegment(v);
        const b = new BeachSegment(v.prevEdge!);
        tail.next = a;
        a.prev = tail;
        a.next = b;
        b.prev = a;
        ts.tail = b;
        tail.rightEdge = new CellBorder(v, v.nextEdge!, v.p);
        a.rightEdge = new CellBorder(v.prevEdge!, v, v.p);
        this.borders.add(tail.rightEdge);
        this.borders.add(a.rightEdge);
        this.checkCircle(a.prev.prev, a.prev, a);
        //this.checkCircle(a.prev, a, b);
      }
      return;
    }

    // case 1: prev Edge is somewhere in the middle of an existing section
    let arc: BeachSegment | undefined;
    let sec: {head: BeachSegment, tail: BeachSegment} | undefined;
    outer: for (const s of this.beachSections) {
      let cur: BeachSegment | undefined = s.head;
      while (cur) {
        if (cur.site === v.prevEdge) {
          arc = cur;
          sec = s;
          break outer;
        }
        cur = cur.next;
      }
    }
    if (arc && sec) {
      const prevSeg = arc.prev;
      if (v.isConvex()) {
        const a = new BeachSegment(v.nextEdge!);
        if (prevSeg) prevSeg.next = a; else sec.head = a;
        a.prev = prevSeg;
        a.next = arc;
        arc.prev = a;
        a.rightEdge = new CellBorder(v.prevEdge!, v.nextEdge!, v.p);
        this.borders.add(a.rightEdge);
        this.checkCircle(prevSeg, a, arc);
        this.checkCircle(a, arc, arc.next);
      } else {
        const a = new BeachSegment(v.nextEdge!);
        const b = new BeachSegment(v);
        if (prevSeg) prevSeg.next = a; else sec.head = a;
        a.prev = prevSeg;
        a.next = b;
        b.prev = a;
        b.next = arc;
        arc.prev = b;
        a.rightEdge = new CellBorder(v, v.nextEdge!, v.p);
        b.rightEdge = new CellBorder(v.prevEdge!, v, v.p);
        this.borders.add(a.rightEdge);
        this.borders.add(b.rightEdge);
        this.checkCircle(prevSeg, a, b);
        this.checkCircle(a, b, arc);
        this.checkCircle(b, arc, arc.next);
      }
      return;
    }

    //case 2: prevEdge not in beachline - pure site event if V.x is inside an existing section
    const above = this.findArcAbove(v.p.x, v.p.y);
    if (!above) {
      this.initSection(v);
      return;
    }
    //split aboveSec into two sections at V.x:
    // Left: [..., arcAbove, V_left?, prevEdge] (arcAbove stays, new tail = prevEdge)
    // Right: [nextEdge, V_right?, arcAbove_copy, ...] (new head = nextEdge, arcAbove_copy inherits old next)
    const { arc: arcAbove, sec: aboveSec } = above;
    const oldNext = arcAbove.next;
    const oldRightEdge = arcAbove.rightEdge;
    if (arcAbove.circleEvent) { arcAbove.circleEvent.valid = false; arcAbove.circleEvent = undefined; }

    //arcAbove_copy: same site, inherits old right connection
    const arcCopy = new BeachSegment(arcAbove.site, undefined, oldRightEdge, oldNext);
    if (oldNext) oldNext.prev = arcCopy;

    if (v.isConvex()) {
      const prevSeg = new BeachSegment(v.prevEdge!);
      const nextSeg = new BeachSegment(v.nextEdge!);

      //Left: arcAbove -> prevSeg
      arcAbove.next = prevSeg;
      prevSeg.prev = arcAbove;

      //Right: nextSeg -> arcCopy
      nextSeg.next = arcCopy;
      arcCopy.prev = nextSeg;

      const [lx,ly] = beachSegmentIntersection(arcAbove.site, v.prevEdge!, v.p.y);
      const [rx,ry] = beachSegmentIntersection(v.nextEdge!, arcCopy.site, v.p.y);
      arcAbove.rightEdge = new CellBorder( v.prevEdge!,arcAbove.site, new Point(lx,ly));
      nextSeg.rightEdge = new CellBorder(arcCopy.site, v.nextEdge!, new Point(rx,ry));
      this.borders.add(arcAbove.rightEdge);
      this.borders.add(nextSeg.rightEdge);

      const rightTail = arcAbove === aboveSec.tail ? arcCopy : aboveSec.tail;
      aboveSec.tail = prevSeg;
      this.beachSections.push({ head: nextSeg, tail: rightTail });

      this.checkCircle(arcAbove.prev, arcAbove, prevSeg);
      this.checkCircle(nextSeg, arcCopy, oldNext);
    } else {
      // Left: [..., arcAbove, vLeft, prevSeg]
      // Right: [nextSeg, vRigth, arcCopy, ...]
      const vLeft = new BeachSegment(v);
      const prevSeg = new BeachSegment(v.prevEdge!);
      const nextSeg = new BeachSegment(v.nextEdge!);
      const vRight = new BeachSegment(v);
      
      //Left: arcAbove -> vLeft -> prevSeg
      arcAbove.next = vLeft;
      vLeft.prev = arcAbove;
      vLeft.next = prevSeg;
      prevSeg.prev = vLeft;

      nextSeg.next = vRight;
      vRight.prev = nextSeg;
      vRight.next = arcCopy;
      arcCopy.prev = vRight;
      
      const [lx,ly] = beachSegmentIntersection(arcAbove.site, v, v.p.y);
      const [rx,ry] = beachSegmentIntersection(v, arcCopy.site, v.p.y);
      arcAbove.rightEdge = new CellBorder(v, arcAbove.site, new Point(lx,ly));
      vLeft.rightEdge = new CellBorder(v.prevEdge!, v, v.p);
      nextSeg.rightEdge = new CellBorder(v, v.nextEdge!, v.p);
      vRight.rightEdge = new CellBorder(arcAbove.site, v, new Point(rx,ry));
      this.borders.add(arcAbove.rightEdge);
      this.borders.add(vLeft.rightEdge);
      this.borders.add(nextSeg.rightEdge);
      this.borders.add(vRight.rightEdge);

      const rightTail = arcAbove === aboveSec.tail ? arcCopy : aboveSec.tail;
      aboveSec.tail = prevSeg;
      this.beachSections.push({ head: nextSeg, tail: rightTail });

      this.checkCircle(arcAbove.prev, arcAbove, vLeft);
      this.checkCircle(arcAbove, vLeft, prevSeg);
      this.checkCircle(nextSeg, vRight, arcCopy);
      this.checkCircle(vRight, arcCopy, oldNext);
    }
  }

  private findArcAbove(x: number, sweepY: number): {arc: BeachSegment, sec: {head: BeachSegment, tail: BeachSegment}} | null {
    for (const sec of this.beachSections) {
      let arc: BeachSegment = sec.head;
      if (arc.site instanceof Vertex ) throw Error("Start of beach lines should be Edge");
      if (x < arc.site.start.p.x + (sweepY - arc.site.start.p.y)*(arc.site.end.p.x - arc.site.start.p.x)/(arc.site.end.p.y - arc.site.start.p.y)) return null;
      while (arc) {
        if (!arc.next) {
          if (arc.site instanceof Vertex ) throw Error("End of beech lines should be Edge");
          if (x < arc.site.start.p.x + (sweepY - arc.site.start.p.y)*(arc.site.end.p.x - arc.site.start.p.x)/(arc.site.end.p.y - arc.site.start.p.y)) return { arc, sec };
          break;
        }
        const [rx] = beachSegmentIntersection(arc.site, arc.next.site, sweepY);
        if (!Number.isFinite(rx) || x <= rx) return { arc, sec };
        arc = arc.next;
      }
    }
    return null;
  }
}




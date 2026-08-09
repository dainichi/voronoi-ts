import { add, dot, perp, Point, scale, sub } from "../Point.js";
import { Border as GenericBorder } from "../Border.js";
import { BeachSegment as GenericBeachSegment } from "../BeachSegment.js";
import { Vertex } from "./Vertex.js";
import { Edge } from "./Edge.js";
import { VertexEvent } from "./VertexEvent.js";
import { CircleEvent } from "../sweep/CircleEvent.js";
import { EventQueue, purgeStaleCircleEvents } from "../sweep/EventQueue.js";
import {
  solve3x3,
  Circle,
  clockwiseCircumcircle,
  lineThroughPointAndPoint,
  matRow,
  circleTangentTo2LinesThroughPoint,
  circleTangentToLineThrough2Points,
  parabolaIntersection,
  parabolaY,
  lineThroughPointAndLine
} from "../Geometry.js";
import { assert } from "../utils.js";
import { BorderEnd as GenericBorderEnd } from "../BorderEnd.js";

type Site = Edge | Vertex;
type Border = GenericBorder<Site>;
type BorderEnd = GenericBorderEnd<Site>;
const Border = GenericBorder;
const BorderEnd = GenericBorderEnd;
type Event = VertexEvent | CircleEvent<BeachSegment>;
const BeachSegment = GenericBeachSegment<Site>;

export type VoronoiCenter = { center: Point; radius: number };
export type BeachSegment = GenericBeachSegment<Site>;

export class Voronoi {
  private static readonly EPS = 1e-9;

  readonly pq = new EventQueue<Event>();

  beachSections: { head: BeachSegment; tail: BeachSegment }[] = [];

  centers = new Set<VoronoiCenter>();
  borders = new Set<Border>();

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

  private emitCircle(circle: Circle, b: BeachSegment): void {
    if (circle.radius <= 0) {
      console.log(`skipping circle event with r=${circle.radius.toFixed(4)} at (${circle.center.x.toFixed(3)}, ${circle.center.y.toFixed(3)}) for ${b}`,);
      return;
    }
    const ce = new CircleEvent(circle, b);
    b.circleEvent = ce;
    this.pq.push(ce);
  }

  private addNewBorder(left: Site, right: Site, start?: Point): Border {
    const a = new Border(left, right);
    if (start) a.start = start;
    this.borders.add(a);
    return a;
  }

  private circle1V2E(as: Vertex, bs: Edge, cs: Edge): Circle | undefined {
    const
      circle = circleTangentTo2LinesThroughPoint(bs.line, cs.line, as.p);
    if (circle) {
      if (as.inCone(circle.center)) {
        return circle;
      } else {
        console.log("1V2E circle event outside cone");
      }
    }
  }

  private circle1E2V(as: Edge, bs: Vertex, cs: Vertex): Circle | undefined {
    const circle = circleTangentToLineThrough2Points(as.line, bs.p, cs.p);
    if (circle) {
      if (bs.inCone(circle.center) && cs.inCone(circle.center)) {
        return circle;
      } else {
        console.log("1E2V circle event outside cone");
      }
    }
  }

  private checkCircle(b?: BeachSegment): void {
    if (!b || !b.prev || !b.next) return;
    const as = b.prev.site,
      bs = b.site,
      cs = b.next.site;
    let circle: Circle | undefined;

    // ─────────────────────────────── EEE ───────────────────────────────
    if (as instanceof Edge && bs instanceof Edge && cs instanceof Edge) {
      const [x, y, r] = solve3x3([matRow(as.line), matRow(bs.line), matRow(cs.line)]);
      circle = { center: { x, y }, radius: r };
    }
    // ─────────────────────────────── VEE ───────────────────────────────
    else if (as instanceof Vertex && bs instanceof Edge && cs instanceof Edge) {
      if (bs.end === as) {
        circle = lineThroughPointAndLine(as.p, bs.line, cs.line)
      } else {
        circle = this.circle1V2E(as, cs, bs);
      }
    }
    // ─────────────────────────────── EVE ───────────────────────────────
    else if (as instanceof Edge && bs instanceof Vertex && cs instanceof Edge) {
      if (as.start === bs && cs.end === bs) {
        //reflex vertex between its own edges: no circle event
      } else if (as.start === bs) {
        circle = lineThroughPointAndLine(bs.p, as.line, cs.line);
      } else if (cs.end === bs) {
        circle = lineThroughPointAndLine(bs.p, cs.line, as.line);
      } else {
        circle = this.circle1V2E(bs, as, cs);
      }
    }
    // ─────────────────────────────── EEV ───────────────────────────────
    else if (as instanceof Edge && bs instanceof Edge && cs instanceof Vertex) {
      if (bs.start === cs) {
        circle = lineThroughPointAndLine(cs.p, bs.line, as.line)
      } else {
        circle = this.circle1V2E(cs, bs, as);
      }
    }
    // ─────────────────────────────── VEV ───────────────────────────────
    else if (as instanceof Vertex && bs instanceof Edge && cs instanceof Vertex) {
      if (bs.start === as || bs.end === as) {
        circle = lineThroughPointAndPoint(as.p, bs.line, cs.p);
      } else if (bs.start === cs) {
        circle = lineThroughPointAndPoint(cs.p, bs.line, as.p);
      } else {
        circle = this.circle1E2V(bs, cs, as);
      }
    }
    // ─────────────────────────────── VVE ───────────────────────────────
    else if (as instanceof Vertex && bs instanceof Vertex && cs instanceof Edge) {
      if (cs.end === bs) {
        circle = lineThroughPointAndPoint(bs.p, cs.line, as.p);
      } else {
        circle = this.circle1E2V(cs, as, bs);
      }
    }
    // ─────────────────────────────── EVV ───────────────────────────────
    else if (as instanceof Edge && bs instanceof Vertex && cs instanceof Vertex) {
      if (as.start === bs) {
        circle = lineThroughPointAndPoint(bs.p, as.line, cs.p);
      } else {
        circle = this.circle1E2V(as, bs, cs);
      }
    }
    // ─────────────────────────────── VVV ───────────────────────────────
    else if (as instanceof Vertex && bs instanceof Vertex && cs instanceof Vertex) {
      circle = clockwiseCircumcircle(as.p, bs.p, cs.p, Voronoi.EPS);
    }

    if (circle) this.emitCircle(circle, b);
  }

  private handleCircleEvent(ce: CircleEvent<BeachSegment>): void {
    const bs = ce.beachSegment;
    const c = ce.circle.center;

    const left = bs.prev!;
    const right = bs.next!;

    left.borderEndOnRight!.fix(c);
    bs.borderEndOnRight!.fix(c);

    bs.remove();

    const b = this.addNewBorder(right.site, left.site, c);
    left.borderEndOnRight = new BorderEnd(b, true);

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
      this.centers.add({ center: ev.circle.center, radius: ev.circle.radius });
      this.handleCircleEvent(ev);
    }
    purgeStaleCircleEvents(this.pq);
    return true;
  }

  compute(): void {
    while (this.step()) { }
  }

  private initSection(v: Vertex): { head: BeachSegment; tail: BeachSegment } {
    const h = new BeachSegment(v.nextEdge), t = new BeachSegment(v.prevEdge);
    this.connectWithBorder(h, t, v.p);
    return { head: h, tail: t };
  }

  private handleVertexEvent(ev: VertexEvent): void {
    const v = ev.vertex;
    const hs = this.beachSections.find((s) => s.head.site === v.prevEdge);
    const ts = this.beachSections.find((s) => s.tail.site === v.nextEdge);

    if (hs && ts) {
      if (hs === ts) {
        hs.head.borderEndOnRight!.fix(v.p);
        this.beachSections.splice(this.beachSections.indexOf(hs), 1);
      } else {
        //Merge: ts.tail (nextEdge) meets hs.head (prevEdge) at v.p
        assert(!v.isConvex(), "convex merge?");
        const a = new BeachSegment(v);

        this.connectWithBorder(ts.tail, a, v.p);
        this.connectWithBorder(a, hs.head, v.p);

        ts.tail = hs.tail;
        this.beachSections.splice(this.beachSections.indexOf(hs), 1);
        this.checkCircle(a.prev);
        this.checkCircle(a);
        this.checkCircle(hs.head);
      }
    } else if (hs) {
      const oldHead = hs.head;
      if (!v.isConvex()) this.addToFront(hs, v, v.p);
      this.addToFront(hs, v.nextEdge, v.p);
      this.checkCircle(oldHead);
    } else if (ts) {
      const oldTail = ts.tail;
      if (!v.isConvex()) this.addToEnd(ts, v, v.p);
      this.addToEnd(ts, v.prevEdge, v.p);
      this.checkCircle(oldTail);
    } else {
      const above = this.findArcAboveOrAddSection(v);
      if (above) {
        assert(!v.isConvex(), "independent convex vertex on sweep line?");

        const { arc: arcAbove, sec: aboveSec } = above;

        arcAbove.clearEvent();

        const arcCopy = new BeachSegment(arcAbove.site, arcAbove.borderEndOnRight);
        if (arcAbove.next) arcAbove.next.prev = arcCopy;
        arcCopy.next = arcAbove.next;

        const newSec = { head: arcCopy, tail: arcAbove === aboveSec.tail ? arcCopy : aboveSec.tail };

        aboveSec.tail = arcAbove;

        this.beachSections.splice(this.beachSections.indexOf(aboveSec) + 1, 0, newSec);

        const b = this.addNewBorder(arcAbove.site, v);

        this.addToEnd(aboveSec, v, new BorderEnd(b, false));
        this.addToEnd(aboveSec, v.prevEdge, v.p);

        this.addToFront(newSec, v, new BorderEnd(b, true));
        this.addToFront(newSec, v.nextEdge, v.p);

        this.checkCircle(arcAbove);
        this.checkCircle(arcAbove.next);
        this.checkCircle(arcCopy.prev);
        this.checkCircle(arcCopy);
      }
    }
  }

  addToEnd(ts: { head: BeachSegment; tail: BeachSegment }, beachSite: Site, startPointOrBorderEnd: Point | BorderEnd) {
    const bs = new BeachSegment(beachSite);
    this.connectWithBorder(ts.tail, bs, startPointOrBorderEnd);
    ts.tail = bs;
  }

  addToFront(hs: { head: BeachSegment; tail: BeachSegment }, beachSite: Site, startPointOrBorderEnd: Point | BorderEnd): void {
    const bs = new BeachSegment(beachSite);
    this.connectWithBorder(bs, hs.head, startPointOrBorderEnd);
    hs.head = bs;
  }

  private findArcAboveOrAddSection(v: Vertex): { arc: BeachSegment; sec: { head: BeachSegment; tail: BeachSegment }; } | null {
    const x = v.p.x;
    const sweepY = v.p.y;
    for (let i = 0; i < this.beachSections.length; i++) {
      const sec = this.beachSections[i];
      let arc: BeachSegment = sec.head;
      assert(arc.site instanceof Edge, "Start of beach lines should be Edge");
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
          assert(arc.site instanceof Edge, "End of beach lines should be Edge");
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
        const rx = beachSegmentIntersection(arc.site, arc.next.site, sweepY).center.x;
        if (!Number.isFinite(rx) || x <= rx) return { arc, sec };
        arc = arc.next;
      }
    }
    const newSec = this.initSection(v);
    this.beachSections.push(newSec);
    return null;
  }

  connectWithBorder(a1: BeachSegment, a2: BeachSegment, startPointOrBorderEnd: Point | BorderEnd) {
    a1.borderEndOnRight = startPointOrBorderEnd instanceof BorderEnd ?
      startPointOrBorderEnd :
      new BorderEnd(this.addNewBorder(a2.site, a1.site, startPointOrBorderEnd), true);
    a1.next = a2;
    a2.prev = a1;
  }
}

export function beachSegmentIntersection(s1: Site, s2: Site, sweepY: number): Circle {
  let circle: Circle | undefined;
  const sweepLine = { normal: { x: 0, y: 1 }, offset: sweepY };
  // ─────────────────────────────── EE ───────────────────────────────
  if (s1 instanceof Edge && s2 instanceof Edge) {
    const [x, y, r] = solve3x3([matRow(s1.line), matRow(s2.line), [0, 1, -1, sweepY]]);
    circle = { center: { x, y }, radius: r };
  }
  // ─────────────────────────────── EV ───────────────────────────────
  else if (s1 instanceof Edge && s2 instanceof Vertex) {
    if (s1.start === s2) {
      circle = lineThroughPointAndLine(s2.p, s1.line, sweepLine);
    } else if (s2.p.y === sweepY) {
      circle = lineThroughPointAndLine(s2.p, sweepLine, s1.line);
    } else {
      circle = circleTangentTo2LinesThroughPoint(s1.line, sweepLine, s2.p);
    }
  }
  // ─────────────────────────────── VE ───────────────────────────────
  else if (s1 instanceof Vertex && s2 instanceof Edge) {
    if (s2.end === s1) {
      circle = lineThroughPointAndLine(s1.p, s2.line, sweepLine);
    } else if (s1.p.y === sweepY) {
      circle = lineThroughPointAndLine(s1.p, sweepLine, s2.line);
    } else {
      circle = circleTangentTo2LinesThroughPoint(sweepLine, s2.line, s1.p);
    }
  }
  // ─────────────────────────────── VV ───────────────────────────────
  else if (s1 instanceof Vertex && s2 instanceof Vertex) {
    const x = parabolaIntersection(s1.p, s2.p, sweepY);
    const y = parabolaY(s1.p, sweepY, x);
    circle = { center: { x, y }, radius: y - sweepY };
  } else {
    throw new Error("Invalid arguments for beachSegmentIntersection");
  }
  if (circle) return circle; else {
    throw new Error("no circle for beachSegmentIntersection");
  }
}


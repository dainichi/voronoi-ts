import { add, dot, perp, Point, scale, sub } from "../Point.js";
import { Border as GenericBorder } from "../Border.js";
import { BeachSegment as GenericBeachSegment } from "../BeachSegment.js";
import { Vertex } from "./Vertex.js";
import { Edge } from "./Edge.js";
import { VertexEvent } from "./VertexEvent.js";
import { CircleEvent } from "../sweep/CircleEvent.js";
import { EventQueue, purgeStaleCircleEvents } from "../sweep/EventQueue.js";
import {
  beachSegmentIntersection,
  edgeEndAndEdge,
  circleCenterOnLine,
  solve3x3,
  Circle,
  clockwiseCircumcircle,
  edgeEndAndVertex
} from "../Geometry.js";
import { assert } from "../utils.js";
import { BorderEnd as GenericBorderEnd } from "../BorderEnd.js";

type Border = GenericBorder<Edge | Vertex>;
type BorderEnd = GenericBorderEnd<Edge | Vertex>;
const Border = GenericBorder;
const BorderEnd = GenericBorderEnd;
type Event = VertexEvent | CircleEvent<BeachSegment>;
const BeachSegment = GenericBeachSegment<Edge | Vertex>;

export type VoronoiCenter = { center: Point; radius: number };
export type BeachSegment = GenericBeachSegment<Edge | Vertex>;

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

  private addNewBorder(left: Edge | Vertex, right: Edge | Vertex, start?: Point): Border {
    const a = new Border(left, right);
    if (start) a.start = start;
    this.borders.add(a);
    return a;
  }

  private checkCircle1V2E(as: Vertex, bs: Edge, cs: Edge, b: BeachSegment): void {
    const
      b_n = bs.normal,
      c_n = cs.normal,
      d_n = sub(b_n, c_n),
      C = bs.offset - cs.offset,
      v = perp(d_n),
      line_s = Math.abs(d_n.x) > 1e-12 ? { x: C / d_n.x, y: 0 } : { x: 0, y: C / d_n.y },
      circle = circleCenterOnLine(line_s, v, as.p, dot(b_n, line_s) - bs.offset, dot(b_n, v))
    if (circle) {
      if (as.inCone(circle.center)) {
        this.emitCircle(circle, b);
      } else {
        console.log("1V2E circle event outside cone");
      }
    }
  }

  private checkCircle1E2V(as: Edge, bs: Vertex, cs: Vertex, b: BeachSegment,): void {
    const a_n = as.normal,
      d_n = scale(sub(cs.p, bs.p), 2),
      C = dot(cs.p, cs.p) - dot(bs.p, bs.p),
      v = perp(d_n),
      line_s = Math.abs(d_n.x) > 1e-12 ? { x: C / d_n.x, y: 0 } : { x: 0, y: C / d_n.y },
      circle = circleCenterOnLine(line_s, v, bs.p, dot(a_n, line_s) - as.offset, dot(a_n, v))
    if (circle) {
      if (bs.inCone(circle.center) && cs.inCone(circle.center)) {
        this.emitCircle(circle, b);
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

    if (as instanceof Edge && bs instanceof Edge && cs instanceof Edge) {
      const [x, y, r] = solve3x3([as.matRow, bs.matRow, cs.matRow]);
      this.emitCircle({ center: { x, y }, radius: r }, b);
    } else if (as instanceof Vertex && bs instanceof Edge && cs instanceof Edge) {
      if (bs.end === as) {
        this.emitCircle(edgeEndAndEdge(as, bs, cs), b);
      } else {
        this.checkCircle1V2E(as, cs, bs, b);
      }
    } else if (as instanceof Edge && bs instanceof Vertex && cs instanceof Edge) {
      if (as.start === bs && cs.end === bs) {
        //reflex vertex between its own edges: no circle event
      } else if (as.start === bs) {
        this.emitCircle(edgeEndAndEdge(bs, as, cs), b);
      } else if (cs.end === bs) {
        this.emitCircle(edgeEndAndEdge(bs, cs, as), b);
      } else {
        this.checkCircle1V2E(bs, as, cs, b);
      }
    } else if (as instanceof Edge && bs instanceof Edge && cs instanceof Vertex) {
      if (bs.start === cs) {
        this.emitCircle(edgeEndAndEdge(cs, bs, as), b);
      } else {
        this.checkCircle1V2E(cs, bs, as, b);
      }
    } else if (as instanceof Vertex && bs instanceof Edge && cs instanceof Vertex) {
      if (bs.start === as || bs.end === as) {
        const circle = edgeEndAndVertex(as, bs, cs);
        if (circle) this.emitCircle(circle, b);
      } else if (bs.start === cs) {
        const circle = edgeEndAndVertex(cs, bs, as);
        if (circle) this.emitCircle(circle, b);
      } else {
        this.checkCircle1E2V(bs, cs, as, b);
      }
    } else if (
      as instanceof Vertex && bs instanceof Vertex && cs instanceof Edge) {
      if (cs.end === bs) {
        const circle = edgeEndAndVertex(bs, cs, as);
        if (circle) this.emitCircle(circle, b);
      } else {
        this.checkCircle1E2V(cs, as, bs, b);
      }
    } else if (as instanceof Edge && bs instanceof Vertex && cs instanceof Vertex) {
      if (as.start === bs) {
        const circle = edgeEndAndVertex(bs, as, cs);
        if (circle) this.emitCircle(circle, b);
      } else {
        this.checkCircle1E2V(as, bs, cs, b);
      }
    } else if (as instanceof Vertex && bs instanceof Vertex && cs instanceof Vertex) {
      const circle = clockwiseCircumcircle(as.p, bs.p, cs.p, Voronoi.EPS);
      if (circle) this.emitCircle(circle, b);
    } else {
      console.log(
        "Circle event not supported for " + as.toString() + " " + bs.toString() + " " + cs.toString());
    }
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

  addToEnd(ts: { head: BeachSegment; tail: BeachSegment }, beachSite: Edge | Vertex, startPointOrBorderEnd: Point | BorderEnd) {
    const bs = new BeachSegment(beachSite);
    this.connectWithBorder(ts.tail, bs, startPointOrBorderEnd);
    ts.tail = bs;
  }

  addToFront(hs: { head: BeachSegment; tail: BeachSegment }, beachSite: Edge | Vertex, startPointOrBorderEnd: Point | BorderEnd): void {
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


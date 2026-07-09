import { Point } from "../Point.js";
import { VoronoiEdge } from "./VoronoiEdge.js";
import { Arc } from "./Arc.js";
import { Vertex } from "./Vertex.js";
import { PolygonEdge } from "./PolygonEdge.js";
import { VertexEvent } from "./VertexEvent.js";
import { CircleEvent } from "./CircleEvent.js";
import type { Event } from "./Event.js";
import { arcIntersection, solve3x3 } from "../Geometry.js";

function compareEvents(a: Event, b: Event): number {
  if(a.y !== b.y) return b.y - a.y;
  return a.x - b.x;
}
export class Voronoi {
  private static readonly EPS = 1e-9;

  readonly pq: Event[] = [];

  beach : {head: Arc, tail: Arc} | null = null;

  centers = new Set<Point>();
  edges = new Set<VoronoiEdge>();

  sweepY = Infinity;

  private addEvent(ev: Event): void {
    let i = 0;
    while (i < this.pq.length && compareEvents(this.pq[i], ev) <= 0) {
      i++;
    }
    this.pq.splice(i, 0, ev);
  }

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
      this.addEvent(new VertexEvent(vertex));
    }
  }

  private checkCircle(a?: Arc, b?: Arc, c?: Arc): void {
    if (!a || !b || !c) return;

    const [x,y,r] = solve3x3([a.edge.matRow, b.edge.matRow, c.edge.matRow]);

    const ce = new CircleEvent(new Point(x, y), r, b);

    b.circleEvent = ce;

    this.addEvent(ce);
  }

  private handleCircleEvent(ce: CircleEvent): void {
    const a = ce.arc;
    const vertex = ce.center;

    if(a.prev?.rightEdge) {
      a.prev.rightEdge.end = vertex;
    }
    if (a.rightEdge) {
      a.rightEdge.end = vertex;
    }


    const left = a.prev!;
    const right = a.next!;

    left.next = right;
    right.prev = left;

    const e = new VoronoiEdge(right.edge, left.edge);
    e.start = vertex;
    this.edges.add(e);

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

  private handleVertexEvent(ev: VertexEvent): void {
    const v = ev.vertex;

    if (!this.beach) {
      let a1 = new Arc(v.nextEdge!);
      let a2 = new Arc(v.prevEdge!);
      a1.next = a2;
      a2.prev = a1;
      a1.rightEdge = new VoronoiEdge(v.prevEdge!, v.nextEdge!);
      a1.rightEdge.start = v.p;
      this.edges.add(a1.rightEdge);
      this.beach = { head: a1, tail: a2 };
      return;
    }

    if (v.prevEdge === this.beach.head.edge && v.nextEdge === this.beach.tail.edge) {
      console.log("Vertex event at both ends of the beachline");
      if (this.beach.head.rightEdge) {
        this.beach.head.rightEdge.end = v.p;
      }
      return;
    } else if (v.prevEdge === this.beach.head.edge) {
      console.log("Vertex event at the head of the beachline");
      let a = new Arc(v.nextEdge!);
      a.next = this.beach.head;
      this.beach.head.prev = a;
      this.beach.head = a;
      a.rightEdge = new VoronoiEdge(v.prevEdge!, v.nextEdge!);
      a.rightEdge.start = v.p;
      this.edges.add(a.rightEdge);
      this.checkCircle(a, a.next, a.next.next);
      return;
    } else if (v.nextEdge === this.beach.tail.edge) {
      console.log("Vertex event at the tail of the beachline");
      let a = new Arc(v.prevEdge!);
      a.prev = this.beach.tail;
      this.beach.tail.next = a;
      this.beach.tail.rightEdge = new VoronoiEdge(v.prevEdge!, v.nextEdge!);
      this.beach.tail.rightEdge.start = v.p;
      this.edges.add(this.beach.tail.rightEdge);
      this.beach.tail = a;
      this.checkCircle(a.prev.prev, a.prev, a);
      return;
    } else {
      throw new Error("Vertex event not at the ends of the beachline, not supported yet");
    }
  }
}

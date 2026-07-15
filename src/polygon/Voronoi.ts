import { Point } from "../Point.js";
import { VoronoiEdge } from "./VoronoiEdge.js";
import { Arc } from "./Arc.js";
import { Vertex } from "./Vertex.js";
import { PolygonEdge } from "./PolygonEdge.js";
import { VertexEvent } from "./VertexEvent.js";
import { CircleEvent } from "../sweep/CircleEvent.js";
import { EventQueue, purgeStaleCircleEvents } from "../sweep/EventQueue.js";
import type { Event } from "./Event.js";
import { arcIntersection, solve3x3 } from "../Geometry.js";

export class Voronoi {
  private static readonly EPS = 1e-9;

  readonly pq = new EventQueue<Event>();

  beach : {head: Arc, tail: Arc} | null = null;

  centers = new Set<Point>();
  edges = new Set<VoronoiEdge>();

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

  private checkCircle(a?: Arc, b?: Arc, c?: Arc): void {
    if (!a || !b || !c) return;

    const [x,y,r] = solve3x3([a.edge.matRow, b.edge.matRow, c.edge.matRow]);

    const ce = new CircleEvent(new Point(x, y), r, b);

    b.circleEvent = ce;

    this.pq.push(ce);
  }

  private handleCircleEvent(ce: CircleEvent<Arc>): void {
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

    const e = new VoronoiEdge(right.edge, left.edge, vertex);
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
    purgeStaleCircleEvents(this.pq);
    return true;
  }

  compute(): void {
    while (this.step()) {}
  }

  private handleVertexEvent(ev: VertexEvent): void {
    const v = ev.vertex;

    if (!this.beach) {
      let a1 = new Arc(v.nextEdge!, undefined, 
        new VoronoiEdge(v.prevEdge!, v.nextEdge!, v.p));
      let a2 = new Arc(v.prevEdge!,a1);
      a1.next = a2;
      this.edges.add(a1.rightEdge!);
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
      a.rightEdge = new VoronoiEdge(v.prevEdge!, v.nextEdge!, v.p);
      this.edges.add(a.rightEdge);
      this.checkCircle(a, a.next, a.next.next);
      return;
    } else if (v.nextEdge === this.beach.tail.edge) {
      console.log("Vertex event at the tail of the beachline");
      let a = new Arc(v.prevEdge!);
      a.prev = this.beach.tail;
      this.beach.tail.next = a;
      this.beach.tail.rightEdge = new VoronoiEdge(v.prevEdge!, v.nextEdge!, v.p);
      this.edges.add(this.beach.tail.rightEdge);
      this.beach.tail = a;
      this.checkCircle(a.prev.prev, a.prev, a);
      return;
    } else {
      throw new Error("Vertex event not at the ends of the beachline, not supported yet");
    }
  }
}

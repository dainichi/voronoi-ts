import { Point } from "../Point.js";
import { Edge } from "./Edge.js";

export class Vertex {
    public prevEdge?: Edge;
    public nextEdge?: Edge;
    constructor(
        public readonly p: Point,
    ) {
    }

    isConvex(): boolean {
        const {prevEdge, nextEdge} = this;
        if (!prevEdge || !nextEdge) return true;
        const dx1 = prevEdge.end.p.x - prevEdge.start.p.x;
        const dy1 = prevEdge.end.p.y - prevEdge.start.p.y;
        const dx2 = nextEdge.end.p.x - nextEdge.start.p.x;
        const dy2 = nextEdge.end.p.y - nextEdge.start.p.y;
        return dx1 * dy2 - dy1 * dx2 > 0;
    }

    toString(): string {
        return `Vertex(${this.p.x}, ${this.p.y})`;
    }


    //x,y closer to  vertex than edges, only meaningful for reflex vertices
 inCone(x: number, y: number): boolean {
    const { prevEdge, nextEdge } = this;
    if (!prevEdge || !nextEdge) return true;

    const px = x - this.p.x;
    const py = y - this.p.y;

    const dx1 = prevEdge.end.p.x - prevEdge.start.p.x;
    const dy1 = prevEdge.end.p.y - prevEdge.start.p.y;

    const dx2 = nextEdge.end.p.x - nextEdge.start.p.x;
    const dy2 = nextEdge.end.p.y - nextEdge.start.p.y;

    return px * dx1 + py * dy1 >= 0 &&
           px * dx2 + py * dy2 <= 0;
}
}
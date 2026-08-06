import { dot, perp, Point, sub } from "../Point.js";
import { Edge } from "./Edge.js";

export class Vertex {
    public prevEdge!: Edge;
    public nextEdge!: Edge;
    constructor(
        public readonly p: Point,
    ) {
    }

    isConvex(): boolean {
        return dot(perp(this.prevEdge.asVec), this.nextEdge.asVec) > 0;
    }

    toString(): string {
        return `Vertex(${this.p.x}, ${this.p.y})`;
    }

    //x,y closer to  vertex than edges, only meaningful for reflex vertices
    inCone(p: Point): boolean {
        const d = sub(p, this.p);
        return dot(d, this.prevEdge.asVec) >= 0 && dot(d, this.nextEdge.asVec) <= 0;
    }
}
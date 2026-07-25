import { Point } from "../Point.js";
import { PolygonEdge } from "./PolygonEdge.js";

export class Vertex {
    public prevEdge?: PolygonEdge;
    public nextEdge?: PolygonEdge;
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
}
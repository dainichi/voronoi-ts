import { Point } from "../Point.js";
import { PolygonEdge } from "./PolygonEdge.js";

export class Vertex {
    public prevEdge?: PolygonEdge;
    public nextEdge?: PolygonEdge;
    constructor(
        public readonly p: Point,
    ) {
    }

    toString(): string {
        return `Vertex(${this.p.x}, ${this.p.y})`;
    }
}
import { Point } from "./Point.js";
import { Vertex } from "./Vertex.js";

export class PolygonEdge {

    public readonly matRow: number[];

    constructor(
        public readonly start: Vertex,
        public readonly end: Vertex
    ) {
        let dx = end.p.x - start.p.x;
        let dy = end.p.y - start.p.y;
        let length = Math.hypot(dx, dy);
        let a = - dy / length;
        let b = dx / length;
        this.matRow = [a, b, -1, a * start.p.x + b * start.p.y];
    }

    toString(): string {
        return `PolygonEdge[${this.start} - ${this.end}]`;
    }
}
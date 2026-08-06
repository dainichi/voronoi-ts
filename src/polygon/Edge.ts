import { dot, perp, length, Point, scale, sub, Vec2, normalize } from "../Point.js";
import { Vertex } from "./Vertex.js";
export class Edge {

    public readonly matRow: [number,number,number,number];
    public readonly normal: Vec2;
    public readonly offset: number;
    public readonly asVec: Vec2;

    constructor(
        public readonly start: Vertex,
        public readonly end: Vertex
    ) {
        this.asVec = sub(end.p, start.p);
        this.normal = normalize(perp(this.asVec));
        this.offset = dot(this.normal, start.p);
        this.matRow = [this.normal.x, this.normal.y, -1, this.offset];
    }

    toString(): string {
        return `PolygonEdge[${this.start} - ${this.end}]`;
    }
}
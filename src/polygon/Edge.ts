import { dot, perp, length, Point, scale, sub, Vec2, normalize } from "../Point.js";
import { Vertex } from "./Vertex.js";
import { Line } from "../Geometry.js";
export class Edge {

    public readonly line: Line;
    public readonly asVec: Vec2;

    constructor(
        public readonly start: Vertex,
        public readonly end: Vertex
    ) {
        this.asVec = sub(end.p, start.p);
        const normal = normalize(perp(this.asVec));
        this.line = {normal, offset: dot(normal, start.p)};
    }

    toString(): string {
        return `PolygonEdge[${this.start} - ${this.end}]`;
    }
}
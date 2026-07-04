import { Vertex } from "./Vertex.js";

export class VertexEvent {
    readonly x: number;
    readonly y: number;

    constructor(public readonly vertex: Vertex) {
        this.x = vertex.p.x;
        this.y = vertex.p.y;
    }

    toString(): string {
        return `VertexEvent(${this.vertex.p})`;
    }
}
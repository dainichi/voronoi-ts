import { add, dot, Point, scale, sub, Vec2 } from "./Point.js";
import { Edge } from "./polygon/Edge.js";
import { Vertex } from "./polygon/Vertex.js";

export type Circle = { center: Point, radius: number };

export function clockwiseCircumcircle(a: Point, b: Point, c: Point, eps = 1e-9): Circle | undefined {
    const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

    if (area > -eps) return undefined;

    const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));

    if (Math.abs(d) < eps) return undefined;

    const x =
        ((a.x * a.x + a.y * a.y) * (b.y - c.y) +
            (b.x * b.x + b.y * b.y) * (c.y - a.y) +
            (c.x * c.x + c.y * c.y) * (a.y - b.y)) /
        d;

    const y =
        ((a.x * a.x + a.y * a.y) * (c.x - b.x) +
            (b.x * b.x + b.y * b.y) * (a.x - c.x) +
            (c.x * c.x + c.y * c.y) * (b.x - a.x)) /
        d;

    return { center: { x, y }, radius: Math.hypot(x - a.x, y - a.y) };
}

export function parabolaIntersection(
    p1: Point,
    p2: Point,
    sweepY: number,
): number {
    const z1 = p1.y - sweepY;
    const z2 = p2.y - sweepY;
    const a = z2 - z1;

    if (a === 0) return (p1.x + p2.x) / 2;

    const b = z1 * p2.x - z2 * p1.x;
    const dx = p1.x - p2.x;
    const d = z1 * z2 * (dx * dx + a * a);
    return (-b + Math.sqrt(d)) / a;
}

export function parabolaY(p: Point, d: number, x: number): number {
    const dx = p.x - x;
    return (dx * dx / (p.y - d) + p.y + d) / 2;
}

// Finds the point on line l0+t*v equidistant from point p
// and an edge whose distance at the reference point is r0, changing at rate rv.
export function circleCenterOnLine(
    l0: Point, v: Vec2,
    p: Point,
    r0: number, rv: number,
): Circle | undefined {
    const d = sub(l0, p);
    const qa = dot(v, v) - rv * rv;
    const qb = 2 * (dot(d, v) - r0 * rv);
    const qc = dot(d, d) - r0 * r0;
    const disc = qb * qb - 4 * qa * qc;
    if (disc < 0) {
        console.log("negative discriminant");
        return undefined;
    }
    const sqrtDisc = Math.sqrt(disc);
    const t = (-qb - sqrtDisc) / (2 * qa);
    const r = r0 + t * rv;

    if (r < 0) {
        console.log("negative radius");
        return undefined;
    }
    return { center: add(l0, scale(v, t)), radius: r };
}

export function edgeEndAndEdge(
    vertex: Vertex,
    edgeThroughVertex: Edge,
    otherEdge: Edge,
): Circle {
    const ev_n = edgeThroughVertex.normal;
    const oe_n = otherEdge.normal;
    const r = (otherEdge.offset - dot(vertex.p, oe_n)) / (dot(ev_n, oe_n) - 1);
    return { center: add(vertex.p, scale(ev_n, r)), radius: r };
}

export function edgeEndAndVertex(
    vertex: Vertex,
    edgeThroughVertex: Edge,
    otherVertex: Vertex,
): Circle | undefined {
    const ev_n = edgeThroughVertex.normal;
    const c = sub(otherVertex.p, vertex.p);
    const denom = 2 * dot(c, ev_n);
    if (Math.abs(denom) < 1e-12) {
        console.log("Denominator too small in edgeEndAndVertex");
        return undefined;
    }
    const r = dot(c, c) / denom;
    return { center: add(vertex.p, scale(ev_n, r)), radius: r };
}


export function beachSegmentIntersection(e1: Edge | Vertex, e2: Edge | Vertex, sweepY: number): Circle {
    if (e1 instanceof Edge && e2 instanceof Edge) {
        const [x, y, r] = solve3x3([e1.matRow, e2.matRow, [0, 1, -1, sweepY]]);
        return { center: { x, y }, radius: r };
    } else if (e1 instanceof Edge && e1.start === e2) {
        const r = (e2.p.y - sweepY) / (1 - e1.normal.y);
        return { center: add(e2.p, scale(e1.normal, r)), radius: r };
    } else if (e2 instanceof Edge && e2.end === e1) {
        const r = (e1.p.y - sweepY) / (1 - e2.normal.y);
        return { center: add(e1.p, scale(e2.normal, r)), radius: r };
    } else if (e1 instanceof Vertex && e2 instanceof Edge) {
        return edgeVertexIntersection(e2, e1, sweepY, true);
    } else if (e1 instanceof Edge && e2 instanceof Vertex) {
        return edgeVertexIntersection(e1, e2, sweepY, false);
    } else if (e1 instanceof Vertex && e2 instanceof Vertex) {
        const x = parabolaIntersection(e1.p, e2.p, sweepY);
        const y = parabolaY(e1.p, sweepY, x);
        return { center: { x, y }, radius: y - sweepY };
    } else {
        throw new Error("Invalid arguments for beachSegmentIntersection");
    }
}

// vertexOnLeft: vertex is the left site -> want larger-x intersection (right boundary of vertex's arc)
//               vertex is the right site -> want smaller-x intersection (left boundary)
// sign = (vx > 0) == vertexOnLeft selects the correct root
function edgeVertexIntersection(edge: Edge, vertex: Vertex, sweepY: number, vertexOnLeft: boolean): Circle {
    const [a, b, , c] = edge.matRow;
    const vx = 1 - b, vy = a;
    const x0 = Math.abs(a) > 1e-12 ? (c - sweepY) / a : 0;
    const y0 = Math.abs(a) > 1e-12 ? 0 : (c - sweepY) / (b - 1);
    const dx = x0 - vertex.p.x, dy = y0 - vertex.p.y;

    const A = vx * vx;
    const B = 2 * (dx * vx + dy * vy) - 2 * vy * (y0 - sweepY);
    const C = dx * dx + dy * dy - (y0 - sweepY) * (y0 - sweepY);

    const sign = (vx > 0) === vertexOnLeft ? 1 : -1;
    const s = (-B + sign * Math.sqrt(Math.max(0, B * B - 4 * A * C))) / (2 * A);

    const x = x0 + s * vx, y = y0 + s * vy;
    return { center: { x, y }, radius: y - sweepY };
}

export function solve3x3(
    matrix: readonly (readonly number[])[],
): [number, number, number] {
    const m = matrix.map((row) => [...row]);

    for (let col = 0; col < 3; col++) {
        let pivot = col;
        for (let row = col + 1; row < 3; row++) {
            if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) {
                pivot = row;
            }
        }
        if (Math.abs(m[pivot][col]) < 1e-12) {
            throw new Error("Singular matrix");
        }
        if (pivot !== col) {
            [m[col], m[pivot]] = [m[pivot], m[col]];
        }
        const div = m[col][col];
        for (let j = col; j < 4; j++) {
            m[col][j] /= div;
        }
        for (let row = 0; row < 3; row++) {
            if (row === col) continue;
            const factor = m[row][col];
            for (let j = col; j < 4; j++) {
                m[row][j] -= factor * m[col][j];
            }
        }
    }
    return [m[0][3], m[1][3], m[2][3]];
}
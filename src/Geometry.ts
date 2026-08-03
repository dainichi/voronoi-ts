import { Point } from "./Point.js";
import { Edge } from "./polygon/Edge.js";
import { Vertex } from "./polygon/Vertex.js";

export function parabolaIntersection(
    p1: Point,
    p2: Point,
    sweepY: number,
): number {
    const z1 = p1.y - sweepY;
    const z2 = p2.y - sweepY;

    const a = z2 - z1;

    if (a === 0) {
        return (p1.x + p2.x) / 2;
    }

    const b = z1 * p2.x - z2 * p1.x;
    const dx = p1.x - p2.x;
    const d = z1 * z2 * (dx * dx + a * a);

    return (-b + Math.sqrt(d)) / a;
}

export function parabolaY(p: Point, d: number, x: number): number {
    const dx = p.x - x;
    return (dx * dx / (p.y - d) + p.y + d) / 2;
}

// Finds the point on line (x0+t*vx, y0+t*vy) equidistant from point (px,py)
// and an edge whose distance at the reference point is r0, changing at rate rv.
export function circleCenterOnLine(
    x0: number, y0: number, vx: number, vy: number,
    px: number, py: number,
    r0: number, rv: number,
): [number, number, number][] {
    const dx = x0 - px, dy = y0 - py;
    const qa = vx * vx + vy * vy - rv * rv;
    const qb = 2 * (dx * vx + dy * vy - r0 * rv);
    const qc = dx * dx + dy * dy - r0 * r0;
    const disc =  qb * qb - 4 * qa * qc;
    if (disc < 0 ) return [];
    const sqrtDisc = Math.sqrt(disc);
    const t1 = (-qb + sqrtDisc) / (2 * qa);
    const t2 = (-qb - sqrtDisc) / (2 * qa);
    const r1 = r0 + t1 * rv, r2 = r0 + t2 * rv;

    let res: [number,number,number][] = [];
    if(r1 >=0) res.push([x0 + t1 * vx, y0 + t1 * vy, r1]);
    if(r2 >=0) res.push([x0 + t2 * vx, y0 + t2 * vy, r2]);
    return res;
}

export function circleCenterAtEdgeEnd(
    vertex: Vertex,
    edgeThroughVertex: Edge,
    otherEdge: Edge,
): [number, number, number] {
  const [ea, eb] = edgeThroughVertex.matRow;
const [fa, fb, , fd] = otherEdge.matRow;

const r = (fd - vertex.p.x * fa - vertex.p.y * fb) / (ea * fa + eb * fb - 1);
return [vertex.p.x + r * ea, vertex.p.y + r * eb, r];
}

export function beachSegmentIntersection(
    e1: Edge | Vertex,
    e2: Edge | Vertex,
    sweepY: number,
): [number,number,number] {
    if (e1 instanceof Edge && e2 instanceof Edge) {
        return solve3x3([e1.matRow, e2.matRow, [0, 1, -1, sweepY]]);
    } else if (e1 instanceof Edge && e1.start === e2) {
        let [a, b, c, d] = e1.matRow;
        const r = (e2.p.y - sweepY) / (1 - b);
        const x = e2.p.x + a * r;
        const y = e2.p.y + b * r;
        return [x, y, r];
    } else if (e2 instanceof Edge && e2.end === e1) {
        let [a, b, c, d] = e2.matRow;
        const r = (e1.p.y - sweepY) / (1 - b);
        const x = e1.p.x + a * r;
        const y = e1.p.y + b * r;
        return [x, y, r];
    } else if (e1 instanceof Vertex && e2 instanceof Edge) {
        return edgeVertexIntersection(e2, e1, sweepY, true);
    } else if (e1 instanceof Edge && e2 instanceof Vertex) {
        return edgeVertexIntersection(e1, e2, sweepY, false);
    } else if (e1 instanceof Vertex && e2 instanceof Vertex) {
        const x = parabolaIntersection(e1.p, e2.p, sweepY);
        const y = parabolaY(e1.p, sweepY, x);
        return [x, y, y - sweepY];
    } else {
        throw new Error("Invalid arguments for beachSegmentIntersection");
    }
}

// vertexOnLeft: vertex is the left site -> want larger-x intersection (right boundary of vertex's arc)
//               vertex is the right site -> want smaller-x intersection (left boundary)
// sign = (vx > 0) == vertexOnLeft selects the correct root

function edgeVertexIntersection(
    edge: Edge,
    vertex: Vertex,
    sweepY: number,
    vertexOnLeft: boolean
): [number,number,number] {
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
    return [x, y, y - sweepY];
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
import { add, dot, perp, Point, scale, sub, Vec2 } from "./Point.js";

export type Line = { normal: Vec2, offset: number };

export function matRow(line: Line): [number, number, number, number] {
    return [line.normal.x, line.normal.y, -1, line.offset];
}

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
export function circleCenterOnLine(l0: Point, v: Vec2, p: Point, r0: number, rv: number): Circle | undefined {
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

export function circleTangentTo2LinesThroughPoint(l1: Line, l2: Line, p: Point): Circle | undefined {
    const
        n1 = l1.normal,
        n2 = l2.normal,
        d_n = sub(n1, n2),
        C = l1.offset - l2.offset,
        v = perp(d_n),
        l0 = Math.abs(d_n.x) > 1e-12 ? { x: C / d_n.x, y: 0 } : { x: 0, y: C / d_n.y };
    return circleCenterOnLine(l0, v, p, dot(n1, l0) - l1.offset, dot(n1, v));
}

export function circleTangentToLineThrough2Points(l: Line, p1: Point, p2: Point): Circle | undefined {
    const a_n = l.normal,
        d_n = scale(sub(p2, p1), 2),
        C = dot(p2, p2) - dot(p1, p1),
        v = perp(d_n),
        line_s = Math.abs(d_n.x) > 1e-12 ? { x: C / d_n.x, y: 0 } : { x: 0, y: C / d_n.y };
    return circleCenterOnLine(line_s, v, p2, dot(a_n, line_s) - l.offset, dot(a_n, v));
}

export function lineThroughPointAndLine(point: Point, lineThroughPoint: Line, otherLine: Line): Circle | undefined {
    const ev_n = lineThroughPoint.normal;
    const oe_n = otherLine.normal;
    const r = (otherLine.offset - dot(point, oe_n)) / (dot(ev_n, oe_n) - 1);
    if (r < 0) {
        console.log("negative radius in LineThroughPointAndLine");
        return undefined;
    }
    return { center: add(point, scale(ev_n, r)), radius: r };
}

export function lineThroughPointAndPoint(point: Point, lineThroughPoint: Line, otherPoint: Point): Circle | undefined {
    const ev_n = lineThroughPoint.normal;
    const c = sub(otherPoint, point);
    const denom = 2 * dot(c, ev_n);
    if (Math.abs(denom) < 1e-12) {
        console.log("Denominator too small in edgeThroughVertexAndVertex");
        return undefined;
    }
    const r = dot(c, c) / denom;
    return { center: add(point, scale(ev_n, r)), radius: r };
}

export function solve3x3(matrix: readonly [
    readonly [number, number, number, number],
    readonly [number, number, number, number],
    readonly [number, number, number, number]]): [number, number, number] {
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
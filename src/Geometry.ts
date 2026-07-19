import { Point } from "./Point.js";
import { PolygonEdge } from "./polygon/PolygonEdge.js";
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

export function beachSegmentIntersection(
  e1: PolygonEdge | Vertex,
  e2: PolygonEdge | Vertex,
  sweepY: number,
): number[] {
  if (e1 instanceof PolygonEdge && e2 instanceof PolygonEdge) {
    return solve3x3([e1.matRow, e2.matRow, [0, 1, -1, sweepY]]);
  } else if (e1 instanceof PolygonEdge && e1.start === e2) {
    let [a, b, c, d] = e1.matRow;
    const r = (e2.p.y - sweepY) / (1 - b);
    const x = e2.p.x + a * r;
    const y = e2.p.y + b * r;
    return [x, y, r];
  } else if (e2 instanceof PolygonEdge && e2.end === e1) { 
    let [a,b,c,d] = e2.matRow;
    const r = (e1.p.y - sweepY) / (1-b);
    const x = e1.p.x + a * r;
    const y = e1.p.y + b * r;
    return [x,y,r];
  }
  else if (e2 instanceof PolygonEdge && e1 instanceof Vertex){
    let [a,b,,c] = e2.matRow;

    // Direction vector of
    // a*x + (b-1)*y = c-sweepY
    const vx = 1 - b;
    const vy = a;

    // A point on the line
    let x0: number;
    let y0: number;

    if (Math.abs(a) > 1e-12) {
        y0 = 0;
        x0 = (c - sweepY) / a;
    } else {
        x0 = 0;
        y0 = (c - sweepY) / (b - 1);
    }

    const dx = x0 - e1.p.x;
    const dy = y0 - e1.p.y;

    const A = vx * vx;
    const B = 2 * (dx * vx + dy * vy) - 2 * vy * (y0 - sweepY);
    const C = dx * dx + dy * dy - (y0 - sweepY) * (y0 - sweepY);

    const disc = B * B - 4 * A * C;

    const sqrtDisc = Math.sqrt(Math.max(0, disc));

    const s = (-B + sqrtDisc) / (2 * A);

    const x = x0 + s * vx;
    const y = y0 + s * vy;
    const r = y - sweepY;

    return [x,y,r];
} else {
    console.log("Cannot caluclate intersection for " + e1.toString() + e2.toString());
    return [];
  }
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

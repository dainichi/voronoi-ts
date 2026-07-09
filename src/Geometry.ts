import { Point } from "./Point.js";
import { PolygonEdge } from "./polygon/PolygonEdge.js";

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

export function arcIntersection(
  e1: PolygonEdge,
  e2: PolygonEdge,
  sweepY: number,
): number[] {
  return solve3x3([e1.matRow, e2.matRow, [0, 1, -1, sweepY]]);
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

import { Point } from "./Point.js";

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

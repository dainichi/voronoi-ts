export class Geometry {
    static parabolaIntersection(p1, p2, sweepY) {
        const z1 = p1.y - sweepY;
        const z2 = p2.y - sweepY;
        const a = z2 - z1;
        const b = z1 * p2.x - z2 * p1.x;
        const dx = p1.x - p2.x;
        const d = z1 * z2 * (dx * dx + a * a);
        return (-b + Math.sqrt(d)) / a;
    }
    static parabolaY(p, d, x) {
        const dx = p.x - x;
        return (dx * dx / (p.y - d) + p.y + d) / 2;
    }
}

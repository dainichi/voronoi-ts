import { describe, expect, it } from "vitest";
import { Point } from "../Point.js";
import { Voronoi } from "./Voronoi.js";

describe("Polygon Voronoi", () => {
    it("computes centers and edges from input polygon vertices", () => {
        const sites = [new Point(0, 0), new Point(4, 0), new Point(2, 4)];
        const voronoi = new Voronoi(sites);

        voronoi.compute();

        expect(voronoi.centers.size).toEqual(1);
        const {center, radius} = voronoi.centers.values().next().value!;
        expect(center.x).toBeCloseTo(2);
        expect(center.y).toBeCloseTo(1.236);
        expect(radius).toBeGreaterThan(0)
        expect(voronoi.borders.size).toEqual(3);

        const edges = Array.from(voronoi.borders);
        expect(edges.some((edge) => edge.start !== null || edge.end !== null)).toBe(true);
    });
});

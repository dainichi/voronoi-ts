import { describe, expect, it } from "vitest";
import { Point } from "./Point.js";
import { Voronoi } from "./Voronoi.js";

describe("Voronoi", () => {
  it("computes centers and edges from input sites", () => {
    const sites = [new Point(0, 0), new Point(4, 0), new Point(2, 4)];
    const voronoi = new Voronoi(sites);

    voronoi.compute();

    expect(voronoi.centers.size).toEqual(1); // The center of the triangle formed by the three points
    let iterator = voronoi.centers.values();
    const center = iterator.next().value!;
    expect(center.x).toBeCloseTo(2);
    expect(center.y).toBeCloseTo(1.236);
    expect(voronoi.edges.size).toEqual(3);


    const edges = Array.from(voronoi.edges);
    expect(edges.some((edge) => edge.start !== null || edge.end !== null)).toBe(true);
  });
});

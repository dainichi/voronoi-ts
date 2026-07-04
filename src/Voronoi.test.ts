import { describe, expect, it } from "vitest";
import { Point } from "./Point.js";
import { Voronoi } from "./Voronoi.js";

describe("Voronoi", () => {
  it("computes centers and edges from input sites", () => {
    const sites = [new Point(0, 0), new Point(4, 0), new Point(2, 4)];
    const voronoi = new Voronoi(sites);

    voronoi.compute();

    expect(voronoi.centers.size).toBeGreaterThan(0);
    expect(voronoi.edges.size).toBeGreaterThan(0);

    const edges = Array.from(voronoi.edges);
    expect(edges.some((edge) => edge.start !== null || edge.end !== null)).toBe(true);
  });
});

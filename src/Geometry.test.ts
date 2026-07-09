import { describe, expect, it } from "vitest";
import { solve3x3 } from "./Geometry.js";

describe("Geometry", () => {
    it("solves3x3", () => {
        const [a, b, c] = solve3x3([[1, 1, 1, 6], [1, 2, 3, 14], [2, 0, 0, 2]]);

        expect(a).toBeCloseTo(1);
        expect(b).toBeCloseTo(2);
        expect(c).toBeCloseTo(3);
    });
});

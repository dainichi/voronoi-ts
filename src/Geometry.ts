import { Point } from "./Point.js";
import { PolygonEdge } from "./PolygonEdge.js";

export function arcIntersection(
  e1: PolygonEdge,
  e2: PolygonEdge,
  sweepY: number,
): number[] {
  return solve3x3([e1.matRow, e2.matRow, [0, 1, -1, sweepY]]);
}

export function solve3x3(
    matrix: readonly (readonly number[])[] // 3x4 augmented matrix
): [number, number, number] {

    const m = matrix.map(row => [...row]);

    for (let col = 0; col < 3; col++) {

        // Find pivot.
        let pivot = col;
        for (let row = col + 1; row < 3; row++) {
            if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) {
                pivot = row;
            }
        }

        if (Math.abs(m[pivot][col]) < 1e-12) {
            throw new Error("Singular matrix");
        }

        // Swap rows.
        if (pivot !== col) {
            [m[col], m[pivot]] = [m[pivot], m[col]];
        }

        // Normalize pivot row.
        const div = m[col][col];
        for (let j = col; j < 4; j++) {
            m[col][j] /= div;
        }

        // Eliminate this column from the other rows.
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
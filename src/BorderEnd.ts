import { Point } from "./Point.js";
import { Border } from "./Border.js";

export class BorderEnd<T> {
    constructor(
        public readonly border: Border<T>,
        public readonly traceWithSiteAOnLeft: boolean
    ) {}

    fix(p : Point) {
        if (this.traceWithSiteAOnLeft) {
            this.border.end = p;
        } else {
            this.border.start = p;
        }
    }
}

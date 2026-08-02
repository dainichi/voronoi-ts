import { Point } from "../Point.js";
import { Border } from "./Border.js";

export class BorderEnd {
    constructor(
        public readonly border: Border,
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

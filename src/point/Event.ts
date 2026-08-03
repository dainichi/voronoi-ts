import type { CircleEvent } from "../sweep/CircleEvent.js";
import type { BeachSegment } from "./BeachSegment.js";
import type { SiteEvent } from "./SiteEvent.js";

export type Event = SiteEvent | CircleEvent<BeachSegment>;
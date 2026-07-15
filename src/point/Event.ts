import type { CircleEvent } from "../sweep/CircleEvent.js";
import type { Arc } from "./Arc.js";
import type { SiteEvent } from "./SiteEvent.js";

export type Event = SiteEvent | CircleEvent<Arc>;
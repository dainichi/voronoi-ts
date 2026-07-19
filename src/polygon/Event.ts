import type { CircleEvent } from "../sweep/CircleEvent.js";
import type { BeachSegment } from "./BeachSegment.js";
import type { VertexEvent } from "./VertexEvent.js";

export type Event = VertexEvent | CircleEvent<BeachSegment>;
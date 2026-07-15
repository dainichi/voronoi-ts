import type { CircleEvent } from "../sweep/CircleEvent.js";
import type { Arc } from "./Arc.js";
import type { VertexEvent } from "./VertexEvent.js";

export type Event = VertexEvent | CircleEvent<Arc>;
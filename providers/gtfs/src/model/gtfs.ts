import type { Temporal } from "temporal-polyfill";

import type { Journey } from "./journey.js";
import type { Trip } from "./trip.js";

export type Gtfs = {
	trips: Map<string, Trip>;
	journeys: Journey[];
	// ---
	importedAt: Temporal.Instant;
	lastModified: string | null;
	etag: string | null;
};

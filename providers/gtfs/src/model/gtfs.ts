import type { Journey } from "./journey.js";
import type { Route } from "./route.js";
import type { Stop } from "./stop.js";
import type { StopTimeStore } from "./stop-time-store.js";
import type { Trip } from "./trip.js";

export type Gtfs = {
	routes: Map<string, Route>;
	stops: Map<string, Stop>;
	trips: Map<string, Trip>;
	journeys: Map<string, Journey>;
	stopTimeStore: StopTimeStore;
	// ---
	importedAt: Temporal.Instant;
	lastModified: string | null;
	etag: string | null;
};

import type { Journey } from "./journey.js";
import type { Route } from "./route.js";
import type { Shape } from "./shape.js";
import type { Stop } from "./stop.js";
import type { StopTimeStore } from "./stop-time-store.js";
import type { Trip } from "./trip.js";

export type Gtfs = {
	routes: Map<string, Route>;
	stops: Map<string, Stop>;
	trips: Map<string, Trip>;
	shapes: Map<string, Shape>;
	journeys: Map<string, Journey>;
	stopTimeStore: StopTimeStore;
	// ---
	importedAt: Temporal.Instant;
	lastModified: string | null;
	etag: string | null;
};

/**
 * Clé d'une course dans {@link Gtfs.journeys} : une même course circule à des dates de service
 * différentes, chacune avec son propre horaire et son propre état temps réel.
 */
export function getJourneyKey(date: Temporal.PlainDate, tripId: string) {
	return `${date.toString()}-${tripId}`;
}

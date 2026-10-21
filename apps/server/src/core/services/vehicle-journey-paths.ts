import type { VehicleJourneyPaths } from "@bus-tracker/contracts";

import { redis } from "../../index.js";
import type { DisposeableVehicleJourney } from "../../types/disposeable-vehicle-journey.js";

export async function loadJourneyPaths(journey: DisposeableVehicleJourney) {
	if (journey.pathRef === undefined) return undefined;

	const refs = journey.cancelledPathRef !== undefined ? [journey.pathRef, journey.cancelledPathRef] : [journey.pathRef];
	const [rawPath, rawCancelledPath] = await redis.mGet(refs);

	// Les tracés expirent d'eux-mêmes : une course encore suivie peut en avoir perdu le sien si son
	// producteur a cessé de le republier.
	if (rawPath === null || rawPath === undefined) return undefined;

	const paths: VehicleJourneyPaths = { path: JSON.parse(rawPath) };
	if (rawCancelledPath !== null && rawCancelledPath !== undefined) {
		paths.cancelled = JSON.parse(rawCancelledPath);
	}

	return paths;
}

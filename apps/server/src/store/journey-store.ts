import { Temporal } from "temporal-polyfill";

import type { DisposeableVehicleJourney } from "../types/disposeable-vehicle-journey.js";

export const journeyStore = new Map<string, DisposeableVehicleJourney>();

setInterval(() => {
	const now = Temporal.Now.instant();
	let sweptJourneys = 0;
	for (const [key, journey] of journeyStore) {
		let shouldDelete = false;

		if (journey.position.type === "GPS") {
			const lastCall = journey.calls?.at(-1);
			shouldDelete =
				(typeof lastCall === "undefined" ||
					now.since(lastCall.expectedTime ?? lastCall.aimedTime).total("minutes") >= 5) &&
				now.since(journey.position.recordedAt).total("minutes") >= 10;
		} else {
			shouldDelete = now.since(journey.updatedAt).total("minutes") >= 2;
		}

		if (shouldDelete) {
			journeyStore.delete(key);
			sweptJourneys += 1;
		}
	}
	console.log("► Swept %d outdated vehicle journeys.", sweptJourneys);
}, 60_000);

export type JourneyStore = typeof journeyStore;

import { Temporal } from "temporal-polyfill";

import type { DisposeableVehicleJourney } from "../types/disposeable-vehicle-journey.js";

export function createJourneyStore() {
	const journeys = new Map<string, DisposeableVehicleJourney>();

	setInterval(() => {
		const now = Temporal.Now.instant();
		let sweptJourneys = 0;
		for (const [key, journey] of journeys) {
			const timeSince = now.since(journey.updatedAt).total("minutes");
			if (timeSince >= 5) {
				journeys.delete(key);
				sweptJourneys += 1;
			}
		}
		console.log("► Swept %d outdated vehicle journeys.", sweptJourneys);
	}, 60_000);

	return journeys;
}

export type JourneyStore = ReturnType<typeof createJourneyStore>;

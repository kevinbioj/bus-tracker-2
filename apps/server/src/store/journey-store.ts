import { Temporal } from "temporal-polyfill";

import type { DisposeableVehicleJourney } from "../types/disposeable-vehicle-journey.js";

export function createJourneyStore() {
	const journeys = new Map<string, DisposeableVehicleJourney>();

	setInterval(() => {
		const now = Temporal.Now.instant();
		let sweptJourneys = 0;
		for (const [key, journey] of journeys) {
			const lastCall = journey.calls?.at(-1);
			if (
				typeof lastCall !== "undefined" &&
				Temporal.Instant.compare(now, lastCall.expectedTime ?? lastCall.aimedTime) < 0
			) {
				continue;
			}

			if (journey.position.type === "GPS" && now.since(journey.position.recordedAt).total("minutes") < 10) {
				continue;
			}

			journeys.delete(key);
			sweptJourneys += 1;
		}
		console.log("► Swept %d outdated vehicle journeys.", sweptJourneys);
	}, 60_000);

	return journeys;
}

export type JourneyStore = ReturnType<typeof createJourneyStore>;

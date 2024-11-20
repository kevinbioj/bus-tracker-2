import { Temporal } from "temporal-polyfill";

import type { DisposeableVehicleJourney } from "../types/disposeable-vehicle-journey.js";

export function createJourneyStore() {
	const journeys = new Map<string, DisposeableVehicleJourney>();

	setInterval(() => {
		const now = Temporal.Now.instant();
		let sweptJourneys = 0;
		for (const [key, journey] of journeys) {
			let shouldDelete = false;

			if (journey.position.type === "GPS") {
				const lastCall = journey.calls?.at(-1);
				shouldDelete =
					(typeof lastCall === "undefined" ||
						now.since(lastCall.expectedTime ?? lastCall.aimedTime).total("minutes") >= 5) &&
					now.since(journey.position.recordedAt).total("minutes") >= 10;
			} else {
				shouldDelete = now.since(journey.updatedAt).total("minutes") >= 5;
			}

			if (shouldDelete) {
				journeys.delete(key);
				sweptJourneys += 1;
			}
		}
		console.log("► Swept %d outdated vehicle journeys.", sweptJourneys);
	}, 60_000);

	return journeys;
}

export type JourneyStore = ReturnType<typeof createJourneyStore>;

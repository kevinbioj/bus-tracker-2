import { Temporal } from "temporal-polyfill";

import type { VehicleJourney } from "@bus-tracker/contracts";

const SWEEP_INTERVAL = Temporal.Duration.from({ seconds: 60 });

export function createJourneyStore() {
	const journeys = new Map<string, VehicleJourney>();
	setInterval(() => {
		const now = Temporal.Now.instant();
		let sweptJourneys = 0;
		for (const [key, journey] of journeys) {
			const timeSince = now.since(journey.updatedAt).total("minutes");
			if (timeSince >= 10) {
				journeys.delete(key);
				sweptJourneys += 1;
			}
		}
		console.log("► Swept %d outdated vehicle journeys.", sweptJourneys);
	}, SWEEP_INTERVAL.total("milliseconds"));
	return journeys;
}

export type JourneyStore = ReturnType<typeof createJourneyStore>;

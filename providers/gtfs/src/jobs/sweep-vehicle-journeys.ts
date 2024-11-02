import { Temporal } from "temporal-polyfill";

import type { Source } from "../model/source.js";
import { padSourceId } from "../utils/pad-source-id.js";

export function sweepJourneys(source: Source) {
	if (typeof source.gtfs === "undefined") return;

	const now = Temporal.Now.instant().epochSeconds;
	const oldJourneyCount = source.gtfs.journeys.length;
	source.gtfs.journeys = source.gtfs.journeys.filter((journey) => {
		const lastCall = journey.calls.at(-1)!;
		return now <= (lastCall.expectedDepartureTime ?? lastCall.aimedDepartureTime).epochSeconds;
	});
	console.log(
		"%s ✓ Swept %d outdated vehicle journeys",
		padSourceId(source),
		oldJourneyCount - source.gtfs.journeys.length,
	);
}

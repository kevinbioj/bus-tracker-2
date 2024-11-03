import { Temporal } from "temporal-polyfill";

import type { Source } from "../model/source.js";

export async function computeNextJourneys(sources: Source[]) {
	console.log("%s ► Computing journeys for the next day.", Temporal.Now.instant());

	for (const source of sources) {
		source.computeNextJourneys();
	}

	console.log();
}

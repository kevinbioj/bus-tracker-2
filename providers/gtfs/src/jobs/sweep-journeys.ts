import type { Source } from "../model/source.js";

export function sweepJourneys(sources: Source[]) {
	console.log("%s ► Sweeping outdated journey entries.", Temporal.Now.instant());

	for (const source of sources) {
		source.sweepJourneys();
	}

	console.log();
	global.gc?.();
}

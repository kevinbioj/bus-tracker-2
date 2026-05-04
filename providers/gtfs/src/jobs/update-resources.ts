import { captureException } from "@bus-tracker/monitoring";

import type { Source } from "../model/source.js";

export async function updateResources(sources: Source[]) {
	console.log("%s ► Checking resources staleness.", Temporal.Now.instant());
	const updatedSources: Source[] = [];
	for (const source of sources) {
		try {
			if (await source.updateGtfs()) {
				updatedSources.push(source);
			}
		} catch (e) {
			console.log();
			console.error(e);
			captureException(e);
			console.log();
		}
	}
	console.log();
	global.gc?.();
	return updatedSources;
}

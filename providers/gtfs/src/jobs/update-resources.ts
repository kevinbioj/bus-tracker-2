import { Temporal } from "temporal-polyfill";

import type { Source } from "../model/source.js";

export async function updateResources(sources: Source[]) {
	console.log("%s ► Checking resources staleness.", Temporal.Now.instant());
	for (const source of sources) {
		try {
			await source.updateGtfs();
		} catch (e) {
			console.log();
			console.error(e);
			console.log();
		}
	}
	console.log();
}

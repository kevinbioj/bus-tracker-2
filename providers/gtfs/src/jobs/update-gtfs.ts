import { Temporal } from "temporal-polyfill";

import { getStaleness } from "../utils/get-staleness.js";
import { padSourceId } from "../utils/pad-source-id.js";

import type { Source } from "../model/source.js";
import { loadGtfs } from "./load-gtfs.js";

export async function updateGtfs(source: Source) {
	const sourceId = padSourceId(source);
	const updateLog = console.draft("%s ► Checking GTFS resource staleness.", sourceId);

	if (typeof source.gtfs === "undefined") {
		updateLog("%s ℹ Resource has not loaded yet (error?), performing a load attempt.", sourceId);
		return loadGtfs(source, true);
	}

	if (source.gtfs.lastModified === null && source.gtfs.etag === null) {
		const delta = Temporal.Now.instant().since(source.gtfs.importedAt).total("minutes");
		if (delta >= 60) {
			updateLog("%s ℹ Current resource is older than 60 minutes (no staleness data): updating resource.", sourceId);
			return loadGtfs(source, false);
		}
		updateLog("%s ℹ Current resource is fresh enough (no staleness data).", sourceId);
		return;
	}

	try {
		updateLog("%s ► Fetching resource staleness at '%s'.", sourceId, source.staticResourceHref);
		const staleness = await getStaleness(source.staticResourceHref);

		if (source.gtfs.lastModified !== staleness.lastModified || source.gtfs.etag !== staleness.etag) {
			updateLog("%s ℹ Fetched staleness is different than current: updating resource.", sourceId);
			return;
		}
		updateLog("%s ℹ Fetched staleness matches current staleness.", sourceId);
	} catch {
		const delta = Temporal.Now.instant().since(source.gtfs.importedAt).total("minutes");
		if (delta >= 60) {
			updateLog(
				"%s ⚠ Failed to fetch resource staleness, and current resource is older than 60 minutes: updating resource.",
				sourceId,
			);
			return loadGtfs(source, false);
		}
		updateLog("%s ⚠ Failed to fetch resource staleness, but current resource looks fresh enough.", sourceId);
	} finally {
		console.log();
	}
}

import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Temporal } from "temporal-polyfill";

import { downloadGtfs } from "../download/download-gtfs.js";
import { importGtfs } from "../import/import-gtfs.js";
import type { Gtfs } from "../model/gtfs.js";
import type { Source } from "../model/source.js";
import { getStaleness } from "../utils/get-staleness.js";
import { padSourceId } from "../utils/pad-source-id.js";
import { createStopWatch } from "../utils/stop-watch.js";

export async function loadGtfs(source: Source, bootstrapping = true) {
	const watch = createStopWatch();
	const sourceId = padSourceId(source);
	const updateLog = console.draft("%s     ► Loading GTFS resource...", sourceId);

	try {
		const resourceDirectory = await mkdtemp(join(tmpdir(), `bt-gtfs_${source.id}_`));
		updateLog("%s 1/2 ► Downloading GTFS resource into temporary directory...", sourceId);
		await downloadGtfs(source.staticResourceHref, resourceDirectory);

		updateLog("%s 2/2 ► Loading GTFS resource contents into memory...", sourceId);
		const gtfs: Gtfs = {
			...(await importGtfs(resourceDirectory, source.gtfsOptions)),
			importedAt: Temporal.Now.instant(),
			...(await getStaleness(source.staticResourceHref).catch(() => ({
				lastModified: null,
				etag: null,
			}))),
		};

		const now = Temporal.Now.instant();
		const dates = [Temporal.Now.plainDateISO()];
		if (bootstrapping && Temporal.Now.zonedDateTimeISO().hour < 6) {
			dates.push(Temporal.Now.plainDateISO().subtract({ days: 1 }));
		}
		for (const trip of gtfs.trips.values()) {
			if (typeof source.allowScheduled === "function" && !source.allowScheduled(trip)) continue;

			const [today, yesterday] = dates;
			if (typeof yesterday !== "undefined") {
				const yesterdayJourney = trip.getScheduledJourney(yesterday);
				if (
					typeof yesterdayJourney !== "undefined" &&
					Temporal.Instant.compare(now, yesterdayJourney.calls.at(-1)!.aimedDepartureTime.toInstant()) < 0
				) {
					gtfs.journeys.push(yesterdayJourney);
				}
			}

			const todayJourney = trip.getScheduledJourney(today!);
			if (
				typeof todayJourney !== "undefined" &&
				Temporal.Instant.compare(now, todayJourney.calls.at(-1)!.aimedDepartureTime.toInstant()) < 0
			) {
				gtfs.journeys.push(todayJourney);
			}

			gtfs.journeys.sort(
				(a, b) => a.calls[0]!.aimedArrivalTime.epochSeconds - b.calls[0]!.aimedArrivalTime.epochSeconds,
			);
		}

		source.gtfs = gtfs;
		updateLog(
			"%s     ✓ Resource loaded in %dms - %d journeys were pre-computed.\n",
			sourceId,
			watch.total(),
			gtfs.journeys.length,
		);
	} catch (cause) {
		updateLog("%s     ✘ Something wrong occurred while loading the resource.", sourceId);
		throw new Error(`Failed to load GTFS resource for '${source.id}'.`, {
			cause,
		});
	}
}

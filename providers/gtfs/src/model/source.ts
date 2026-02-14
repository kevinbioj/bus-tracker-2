import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { VehicleJourney } from "@bus-tracker/contracts";

import { downloadGtfs } from "../download/download-gtfs.js";
import { type ImportGtfsOptions, importGtfs } from "../import/import-gtfs.js";
import { getStaleness } from "../utils/get-staleness.js";
import { padSourceId } from "../utils/pad-source-id.js";
import { createStopWatch } from "../utils/stop-watch.js";
import type { Gtfs } from "./gtfs.js";
import type { TripUpdate, VehicleDescriptor, VehiclePosition } from "./gtfs-rt.js";
import type { Journey } from "./journey.js";
import type { Trip } from "./trip.js";

export type SourceOptions = {
	// --- Data provisioning
	staticResourceHref: string;
	realtimeResourceHrefs?: string[];
	gtfsOptions?: ImportGtfsOptions;
	appendTripUpdateInformation?: boolean;
	allowTripGuessing?: boolean;
	// --- Additional data acquirance
	mode?: "ALL" | "VP-ONLY" | "VP+TU" | "NO-TU";
	excludeScheduled?: ((trip: Trip) => boolean) | boolean;
	getAheadTime?: (journey?: Journey) => number;
	getNetworkRef: (journey?: Journey, vehicle?: VehicleDescriptor) => string;
	getOperatorRef?: (journey?: Journey, vehicle?: VehicleDescriptor) => string | undefined;
	getVehicleRef?: (vehicle?: VehicleDescriptor, journey?: Journey) => string | undefined;
	getDestination?: (journey?: Journey, vehicle?: VehicleDescriptor) => string | undefined;
	// --- Data transformation
	mapLineRef?: (lineRef: string) => string;
	mapStopRef?: (stopRef: string) => string;
	mapTripRef?: (tripRef: string) => string;
	mapTripUpdate?: (tripUpdate: TripUpdate) => TripUpdate | undefined;
	mapVehiclePosition?: (vehicle: VehiclePosition) => VehiclePosition | undefined;
	isValidJourney?: (vehicleJourney: VehicleJourney) => boolean;
};

export class Source {
	gtfs?: Gtfs;

	constructor(
		readonly id: string,
		readonly options: SourceOptions,
	) {}

	/**
	 * Imports the latest GTFS resource available for this source. Overwrites the
	 * current resource if exists.
	 * @param updating Whether this is an update or an initial import (log-only).
	 */
	async importGtfs(updating = false) {
		const watch = createStopWatch();
		const sourceId = padSourceId(this.id);
		const updateLog = console.draft("%s     ► %s GTFS resource...", updating ? "Updating" : "Importing", sourceId);

		const resourceDirectory = await mkdtemp(join(tmpdir(), `bt-gtfs_${this.id}_`));

		try {
			updateLog("%s 1/3 ► Downloading GTFS resource into temporary directory...", sourceId);
			await downloadGtfs(this.options.staticResourceHref, resourceDirectory);

			updateLog("%s 2/3 ► Loading GTFS resource contents into memory...", sourceId);
			const gtfs: Gtfs = {
				...(await importGtfs(resourceDirectory, this.options.gtfsOptions)),
				importedAt: Temporal.Now.instant(),
				...(await getStaleness(this.options.staticResourceHref).catch(() => ({
					lastModified: null,
					etag: null,
				}))),
			};

			updateLog("%s 3/3 ► Pre-computing scheduled journeys...", sourceId);
			if (typeof this.options.excludeScheduled !== "boolean") {
				const now = Temporal.Now.zonedDateTimeISO();
				const dates = [...(now.hour < 6 ? [now.subtract({ days: 1 }).toPlainDate()] : []), now.toPlainDate()];

				for (const trip of gtfs.trips.values()) {
					if (this.options.excludeScheduled?.(trip)) continue;

					const journeys = dates.map((date) => trip.getScheduledJourney(date));
					for (const journey of journeys) {
						if (typeof journey === "undefined") continue;
						if (now.epochMilliseconds > journey.calls.at(-1)!.aimedDepartureTime.epochMilliseconds) continue;
						gtfs.journeys.set(`${journey.date.toString()}-${journey.trip.id}`, journey);
					}
				}
			}

			updateLog(
				"%s     ✓ Resource %s in %dms - %d journeys were pre-computed.\n",
				sourceId,
				updating ? "updated" : "imported",
				watch.total(),
				gtfs.journeys.size,
			);
			this.gtfs = gtfs;
		} catch (cause) {
			updateLog(
				"%s     ✘ Something wrong occurred while %s the resource.",
				sourceId,
				updating ? "updating" : "importing",
			);
			throw new Error(`Failed to load GTFS resource for '${this.id}'.`, {
				cause,
			});
		} finally {
			await rm(resourceDirectory, { recursive: true, force: true });
		}
	}

	/**
	 * Checks whether the current GTFS resource needs to be updated (either based
	 * on its import age, or actual freshness indicators). If so, the resource is
	 * automatically updated.
	 */
	async updateGtfs() {
		const sourceId = padSourceId(this.id);
		const updateLog = console.draft("%s ► Checking GTFS resource staleness.", sourceId);

		if (typeof this.gtfs === "undefined") {
			updateLog("%s ℹ Resource has not loaded yet (error?), performing a load attempt.", sourceId);
			return this.importGtfs();
		}

		if (this.gtfs.lastModified === null && this.gtfs.etag === null) {
			const delta = Temporal.Now.instant().since(this.gtfs.importedAt).total("minutes");
			if (delta >= 60) {
				updateLog("%s ℹ Current resource is older than 60 minutes (no staleness data): updating resource.", sourceId);
				return this.importGtfs(true);
			}
			updateLog("%s ℹ Current resource is fresh enough (no staleness data).", sourceId);
			return;
		}

		try {
			updateLog("%s ► Fetching resource staleness at '%s'.", sourceId, this.options.staticResourceHref);
			const staleness = await getStaleness(this.options.staticResourceHref);

			if (this.gtfs.lastModified !== staleness.lastModified || this.gtfs.etag !== staleness.etag) {
				updateLog("%s ℹ Fetched staleness is different than current: updating resource.", sourceId);
				return this.importGtfs(true);
			}
			updateLog("%s ℹ Fetched staleness matches current staleness: keeping current resource.", sourceId);
		} catch {
			const delta = Temporal.Now.instant().since(this.gtfs.importedAt).total("minutes");
			if (delta >= 60) {
				updateLog(
					"%s ⚠ Failed to fetch resource staleness, and current resource is older than 60 minutes: updating resource.",
					sourceId,
				);
				return this.importGtfs(true);
			}
			updateLog("%s ⚠ Failed to fetch resource staleness, but current resource looks fresh enough.", sourceId);
		} finally {
			console.log();
		}
	}

	computeNextJourneys() {
		const sourceId = padSourceId(this.id);
		if (typeof this.gtfs === "undefined") {
			console.warn("%s ⚠ Source has no loaded GTFS data, ignoring.", sourceId);
			return;
		}

		const date = Temporal.Now.plainDateISO();

		const updateLog = console.draft("%s ► Computing journeys for date '%s'.", sourceId, date);
		const watch = createStopWatch();

		let computedJourneys = 0;

		if (typeof this.options.excludeScheduled !== "boolean") {
			for (const trip of this.gtfs.trips.values()) {
				if (this.options.excludeScheduled?.(trip)) continue;

				const journey = trip.getScheduledJourney(date);
				if (typeof journey === "undefined") continue;

				this.gtfs.journeys.set(`${date.toString()}-${trip.id}`, journey);
				computedJourneys += 1;
			}

			// this.gtfs.journeys.sort((a, b) =>
			// 	Temporal.ZonedDateTime.compare(a.calls[0]!.aimedArrivalTime, b.calls[0]!.aimedArrivalTime),
			// );
		}

		updateLog("%s ✓ Computed %d journeys for date '%s' in %dms.", sourceId, computedJourneys, date, watch.total());
	}

	sweepJourneys() {
		if (typeof this.gtfs === "undefined") return;

		const now = Temporal.Now.instant().epochMilliseconds;
		const oldJourneyCount = this.gtfs.journeys.size;

		for (const [id, journey] of this.gtfs.journeys) {
			const lastCall = journey.calls.at(-1)!;
			if (now > (lastCall.expectedDepartureTime ?? lastCall.aimedDepartureTime).epochMilliseconds) {
				this.gtfs.journeys.delete(id);
			}
		}

		console.log(
			"%s ✓ Swept %d outdated vehicle journeys",
			padSourceId(this.id),
			oldJourneyCount - this.gtfs.journeys.size,
		);
	}
}

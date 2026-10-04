import type { VehicleJourneyCallFlags } from "@bus-tracker/contracts";

import { getEpochMsFromSecs } from "../cache/temporal-cache.js";

import { Journey } from "./journey.js";
import type { Route } from "./route.js";
import type { Service } from "./service.js";
import type { Shape } from "./shape.js";
import type { Stop } from "./stop.js";
import type { StopTimeStore } from "./stop-time-store.js";

const EMPTY_FLAGS: VehicleJourneyCallFlags[] = [];

function bitmaskToFlags(bitmask: number): VehicleJourneyCallFlags[] {
	if (bitmask === 0) return EMPTY_FLAGS;
	const result: VehicleJourneyCallFlags[] = [];
	if (bitmask & 1) result.push("NO_PICKUP");
	if (bitmask & 2) result.push("NO_DROP_OFF");
	return result;
}

export type StopTimeCall = {
	aimedArrivalTime: number;
	aimedDepartureTime: number;
	expectedArrivalTime?: number;
	expectedDepartureTime?: number;
	stop: Stop;
	sequence: number;
	status: "SCHEDULED" | "UNSCHEDULED" | "SKIPPED";
	headsign?: string;
};

export class Trip {
	constructor(
		/** Index du trip dans les tableaux per-trip du StopTimeStore. */
		readonly idx: number,
		readonly id: string,
		readonly route: Route,
		readonly service: Service,
		readonly store: StopTimeStore,
		readonly direction: 0 | 1,
		readonly headsign?: string,
		readonly block?: string,
		readonly shape?: Shape,
		/** Accessibilité en fauteuil roulant (`wheelchair_accessible`) : `undefined` lorsqu'elle est inconnue. */
		readonly wheelchairAccessible?: boolean,
		/** Acceptation des vélos à bord (`bikes_allowed`) : `undefined` lorsqu'elle est inconnue. */
		readonly bikesAllowed?: boolean,
		/** Nom commercial de la course (`trip_short_name`), typiquement le numéro de train. */
		readonly shortName?: string,
	) {}

	get stopTimeStart() {
		return this.store.tripStart[this.idx]!;
	}
	get stopTimeCount() {
		return this.store.tripCount[this.idx]!;
	}
	get firstArrivalSecs() {
		return this.store.tripFirstArrivalSecs[this.idx]!;
	}
	get lastArrivalSecs() {
		return this.store.tripLastArrivalSecs[this.idx]!;
	}
	get lastDepartureSecs() {
		return this.store.tripLastDepartureSecs[this.idx]!;
	}

	computeCallsForDate(date: Temporal.PlainDate) {
		const start = this.stopTimeStart;
		const count = this.stopTimeCount;
		// Les heures de stop_times.txt sont toujours exprimées dans le fuseau de l'agence, jamais
		// dans celui de l'arrêt (spec GTFS) : c'est ce qui garantit que les heures d'une course
		// croissent même lorsqu'elle traverse des fuseaux. `stop_timezone` ne sert qu'à restituer
		// l'instant obtenu en heure locale de l'arrêt, à la sérialisation.
		const tz = this.route.agency.timeZone;
		const { store } = this;
		const { stopList, stopIdx, sequence, flagsBitmask, arrivalSecs, departureSecs, distanceTraveled } = store;

		const calls = new Array(count);
		for (let i = 0; i < count; i++) {
			const idx = start + i;
			const aSecs = arrivalSecs[idx]!;
			const dSecs = departureSecs[idx]!;
			const stop = stopList[stopIdx[idx]!]!;

			const aimedArrivalTimeMs = getEpochMsFromSecs(date, aSecs, tz);
			const aimedDepartureTimeMs = dSecs === aSecs ? aimedArrivalTimeMs : getEpochMsFromSecs(date, dSecs, tz);

			const dist = distanceTraveled[idx]!;
			calls[i] = {
				aimedArrivalTime: aimedArrivalTimeMs,
				expectedArrivalTime: undefined as number | undefined,
				aimedDepartureTime: aimedDepartureTimeMs,
				expectedDepartureTime: undefined as number | undefined,
				stop,
				sequence: sequence[idx]!,
				platform: stop.platformCode,
				distanceTraveled: Number.isNaN(dist) ? undefined : dist,
				status: "SCHEDULED" as const,
				flags: bitmaskToFlags(flagsBitmask[idx]!),
				headsign: store.getStopHeadsign(idx),
			};
		}
		return calls;
	}

	getScheduledJourney(date: Temporal.PlainDate, force: true): Journey;
	getScheduledJourney(date: Temporal.PlainDate, force?: false): Journey | undefined;
	getScheduledJourney(date: Temporal.PlainDate, force = false) {
		if (!force && !this.service.runsOn(date)) return;

		const tz = this.route.agency.timeZone;
		const firstCallArrivalMs = getEpochMsFromSecs(date, this.firstArrivalSecs, tz);
		const lastCallDepartureMs = getEpochMsFromSecs(date, this.lastDepartureSecs, tz);

		return new Journey(`${this.id}:${date}`, this, date, firstCallArrivalMs, lastCallDepartureMs);
	}
}

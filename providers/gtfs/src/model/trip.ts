import type { VehicleJourneyCallFlags } from "@bus-tracker/contracts";

import { createZonedDateTimeFromSecs } from "../cache/temporal-cache.js";

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
};

export class Trip {
	/** Index dans le StopTimeStore (assigné après lecture des stop_times). */
	stopTimeStart = 0;
	/** Nombre de stop_times pour ce trip. */
	stopTimeCount = 0;
	/** Heure d'arrivée au premier arrêt, secondes depuis minuit du jour 0 (modulus inclus). */
	firstArrivalSecs = 0;
	/** Heure d'arrivée au dernier arrêt, secondes depuis minuit du jour 0 (modulus inclus). */
	lastArrivalSecs = 0;
	/** Heure de départ au dernier arrêt, secondes depuis minuit du jour 0 (modulus inclus). */
	lastDepartureSecs = 0;

	constructor(
		readonly id: string,
		readonly route: Route,
		readonly service: Service,
		readonly store: StopTimeStore,
		readonly direction: 0 | 1,
		readonly headsign?: string,
		readonly block?: string,
		readonly shape?: Shape,
	) {}

	computeCallsForDate(date: Temporal.PlainDate) {
		const start = this.stopTimeStart;
		const count = this.stopTimeCount;
		const tz = this.route.agency.timeZone;
		const { stops, sequence, flagsBitmask, arrivalSecs, departureSecs, distanceTraveled } = this.store;

		const calls = new Array(count);
		for (let i = 0; i < count; i++) {
			const idx = start + i;
			const aSecs = arrivalSecs[idx]!;
			const dSecs = departureSecs[idx]!;

			const aimedArrivalTimeMs = createZonedDateTimeFromSecs(date, aSecs, tz).epochMilliseconds;
			const aimedDepartureTimeMs =
				dSecs === aSecs ? aimedArrivalTimeMs : createZonedDateTimeFromSecs(date, dSecs, tz).epochMilliseconds;

			const dist = distanceTraveled[idx]!;
			calls[i] = {
				aimedArrivalTime: aimedArrivalTimeMs,
				expectedArrivalTime: undefined as number | undefined,
				aimedDepartureTime: aimedDepartureTimeMs,
				expectedDepartureTime: undefined as number | undefined,
				stop: stops[idx]!,
				sequence: sequence[idx]!,
				distanceTraveled: Number.isNaN(dist) ? undefined : dist,
				status: "SCHEDULED" as const,
				flags: bitmaskToFlags(flagsBitmask[idx]!),
			};
		}
		return calls;
	}

	getScheduledJourney(date: Temporal.PlainDate, force: true): Journey;
	getScheduledJourney(date: Temporal.PlainDate, force?: false): Journey | undefined;
	getScheduledJourney(date: Temporal.PlainDate, force = false) {
		if (!force && !this.service.runsOn(date)) return;

		const tz = this.route.agency.timeZone;
		const firstCallArrivalMs = createZonedDateTimeFromSecs(date, this.firstArrivalSecs, tz).epochMilliseconds;
		const lastCallDepartureMs = createZonedDateTimeFromSecs(date, this.lastDepartureSecs, tz).epochMilliseconds;

		return new Journey(`${this.id}:${date}`, this, date, firstCallArrivalMs, lastCallDepartureMs);
	}
}

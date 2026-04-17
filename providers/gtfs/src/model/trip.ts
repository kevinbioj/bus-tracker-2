import type { VehicleJourneyCallFlags } from "@bus-tracker/contracts";

import { createZonedDateTime } from "../cache/temporal-cache.js";

import { Journey } from "./journey.js";
import type { Route } from "./route.js";
import type { Service } from "./service.js";
import type { Shape } from "./shape.js";
import type { Stop } from "./stop.js";
import type { StopTime } from "./stop-time.js";

/** Tableau vide partagé pour les arrêts sans flags (évite les allocations répétées). */
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
	constructor(
		readonly id: string,
		readonly route: Route,
		readonly service: Service,
		readonly stopTimes: StopTime[],
		readonly direction: 0 | 1,
		readonly headsign?: string,
		readonly block?: string,
		readonly shape?: Shape,
	) {}

	computeCallsForDate(date: Temporal.PlainDate) {
		return this.stopTimes.map((stopTime) => {
			const aimedArrivalTime = createZonedDateTime(
				date.add({ days: stopTime.arrivalModulus }),
				stopTime.arrivalTime,
				this.route.agency.timeZone,
			);
			const aimedArrivalTimeMs = aimedArrivalTime.epochMilliseconds;

			return {
				aimedArrivalTime: aimedArrivalTimeMs,
				expectedArrivalTime: undefined as number | undefined,
				aimedDepartureTime: stopTime.departureTime
					? createZonedDateTime(
							date.add({ days: stopTime.departureModulus }),
							stopTime.departureTime,
							this.route.agency.timeZone,
						).epochMilliseconds
					: aimedArrivalTimeMs,
				expectedDepartureTime: undefined as number | undefined,
				stop: stopTime.stop,
				sequence: stopTime.sequence,
				distanceTraveled: stopTime.distanceTraveled,
				status: "SCHEDULED" as const,
				flags: bitmaskToFlags(stopTime.flagsBitmask),
			};
		});
	}

	getScheduledJourney(date: Temporal.PlainDate, force: true): Journey;
	getScheduledJourney(date: Temporal.PlainDate, force?: false): Journey | undefined;
	getScheduledJourney(date: Temporal.PlainDate, force = false) {
		if (this.stopTimes.length < 2 || (!force && !this.service.runsOn(date))) return;

		const firstStopTime = this.stopTimes[0]!;
		const lastStopTime = this.stopTimes.at(-1)!;

		const firstCallArrivalMs = createZonedDateTime(
			date.add({ days: firstStopTime.arrivalModulus }),
			firstStopTime.arrivalTime,
			this.route.agency.timeZone,
		).epochMilliseconds;

		const lastCallDepartureMs = createZonedDateTime(
			date.add({ days: lastStopTime.departureModulus ?? lastStopTime.arrivalModulus }),
			lastStopTime.departureTime ?? lastStopTime.arrivalTime,
			this.route.agency.timeZone,
		).epochMilliseconds;

		return new Journey(`${this.id}:${date}`, this, date, firstCallArrivalMs, lastCallDepartureMs);
	}
}

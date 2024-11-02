import type { Temporal } from "temporal-polyfill";

import { createZonedDateTime } from "../cache/temporal-cache.js";

import { Journey } from "./journey.js";
import type { Route } from "./route.js";
import type { Service } from "./service.js";
import type { Shape } from "./shape.js";
import type { StopTime } from "./stop-time.js";
import type { Stop } from "./stop.js";

export type StopTimeCall = {
	aimedArrivalTime: Temporal.ZonedDateTime;
	aimedDepartureTime: Temporal.ZonedDateTime;
	expectedArrivalTime?: Temporal.ZonedDateTime;
	expectedDepartureTime?: Temporal.ZonedDateTime;
	stop: Stop;
	sequence: number;
	status: "SCHEDULED" | "SKIPPED";
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

	getScheduledJourney(date: Temporal.PlainDate, force: true): Journey;
	getScheduledJourney(date: Temporal.PlainDate, force?: false): Journey | undefined;
	getScheduledJourney(date: Temporal.PlainDate, force = false) {
		if (!force && !this.service.runsOn(date)) return;

		return new Journey(
			`${this.id}:${date}`,
			this,
			date,
			this.stopTimes.map((stopTime) => {
				const aimedArrivalTime = createZonedDateTime(
					date.add({ days: stopTime.arrivalModulus }),
					stopTime.arrivalTime,
					this.route.agency.timeZone,
				);
				return {
					aimedArrivalTime,
					expectedArrivalTime: undefined,
					aimedDepartureTime: stopTime.departureTime
						? createZonedDateTime(
								date.add({ days: stopTime.departureModulus }),
								stopTime.departureTime,
								this.route.agency.timeZone,
							)
						: aimedArrivalTime,
					expectedDepartureTime: undefined,
					stop: stopTime.stop,
					sequence: stopTime.sequence,
					status: "SCHEDULED",
				};
			}),
		);
	}
}

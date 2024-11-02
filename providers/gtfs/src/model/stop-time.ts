import type { Temporal } from "temporal-polyfill";

import type { Stop } from "./stop.js";

export class StopTime {
	constructor(
		readonly sequence: number,
		readonly stop: Stop,
		readonly arrivalTime: Temporal.PlainTime,
		readonly arrivalModulus: number,
		readonly departureTime?: Temporal.PlainTime,
		readonly departureModulus?: number,
		readonly distanceTraveled?: number,
	) {}
}

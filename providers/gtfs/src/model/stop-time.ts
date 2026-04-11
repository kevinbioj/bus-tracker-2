import type { Stop } from "./stop.js";

export class StopTime {
	constructor(
		readonly sequence: number,
		readonly stop: Stop,
		/** Bitmask: 1 = NO_PICKUP, 2 = NO_DROP_OFF */
		readonly flagsBitmask: number,
		readonly arrivalTime: Temporal.PlainTime,
		readonly arrivalModulus: number,
		readonly departureTime?: Temporal.PlainTime,
		readonly departureModulus?: number,
		public distanceTraveled?: number,
	) {}
}

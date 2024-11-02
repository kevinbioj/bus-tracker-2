import type { Temporal } from "temporal-polyfill";

export class Agency {
	constructor(
		readonly id: string,
		readonly name: string,
		readonly timeZone: Temporal.TimeZone,
	) {}
}

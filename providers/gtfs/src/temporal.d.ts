import type { Temporal as TemporalPolyfill } from "temporal-polyfill";

declare global {
	var Temporal: typeof TemporalPolyfill;

	namespace Temporal {
		export type Instant = TemporalPolyfill.Instant;
		export type ZonedDateTime = TemporalPolyfill.ZonedDateTime;
		export type PlainDate = TemporalPolyfill.PlainDate;
		export type PlainTime = TemporalPolyfill.PlainTime;
		export type PlainDateTime = TemporalPolyfill.PlainDateTime;
		export type Duration = TemporalPolyfill.Duration;
	}
}

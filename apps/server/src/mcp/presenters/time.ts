export const DEFAULT_TIMEZONE = "Europe/Paris";

export function toLocalTime(value: string | Temporal.Instant, timezone: string) {
	return Temporal.Instant.from(value)
		.toZonedDateTimeISO(timezone)
		.toString({ smallestUnit: "minute", timeZoneName: "never" });
}

export function nowIn(timezone: string) {
	return toLocalTime(Temporal.Now.instant(), timezone);
}

export function minutesBetween(from: string, to: string) {
	return Math.round((Date.parse(to) - Date.parse(from)) / 60_000);
}

export function todayIn(timezone: string) {
	return Temporal.Now.plainDateISO(timezone);
}

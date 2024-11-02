import { Temporal } from "temporal-polyfill";

export function guessStartDate(
	startTime: Temporal.PlainTime,
	startModulus: number,
	at = Temporal.Now.zonedDateTimeISO(),
) {
	const atDate = at.toPlainDate();
	if (at.hour < 12 && (startModulus > 0 || startTime.hour > 20)) {
		return atDate.subtract({ days: 1 });
	}
	return atDate;
}

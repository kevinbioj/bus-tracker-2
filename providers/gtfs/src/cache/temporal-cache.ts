import { Temporal } from "temporal-polyfill";

const plainDateCache = new Map<string, Temporal.PlainDate>();

export function createPlainDate(item: string) {
	let plainDate = plainDateCache.get(item);
	if (typeof plainDate === "undefined") {
		plainDate = Temporal.PlainDate.from(item);
		plainDateCache.set(item, plainDate);
	}
	return plainDate;
}

const plainTimeCache = new Map<string, Temporal.PlainTime>();

export function createPlainTime(item: string) {
	let plainTime = plainTimeCache.get(item);
	if (typeof plainTime === "undefined") {
		plainTime = Temporal.PlainTime.from(item);
		plainTimeCache.set(item, plainTime);
	}
	return plainTime;
}

const zonedDateTimeCache = new Map<string, Temporal.ZonedDateTime>();

export function createZonedDateTime(date: Temporal.PlainDate, time: Temporal.PlainTime, timeZone: Temporal.TimeZone) {
	const key = `${date}_${time}_${timeZone}`;
	let zonedDateTime = zonedDateTimeCache.get(key);
	if (typeof zonedDateTime === "undefined") {
		zonedDateTime = date.toZonedDateTime({ plainTime: time, timeZone });
		zonedDateTimeCache.set(key, zonedDateTime);
	}
	return zonedDateTime;
}

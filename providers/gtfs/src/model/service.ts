import { createPlainDate } from "../cache/temporal-cache.js";

export class Service {
	constructor(
		readonly id: string,
		readonly days: [boolean, boolean, boolean, boolean, boolean, boolean, boolean] = [
			false,
			false,
			false,
			false,
			false,
			false,
			false,
		],
		readonly startsOn: Temporal.PlainDate = createPlainDate("20020611"),
		readonly endsOn: Temporal.PlainDate = createPlainDate("20991231"),
		readonly excludedDates: Temporal.PlainDate[] = [],
		readonly includedDates: Temporal.PlainDate[] = [],
	) {}

	runsOn(date: Temporal.PlainDate) {
		if (this.includedDates.some((includedDate) => includedDate.equals(date))) {
			return true;
		}

		if (this.excludedDates.some((excludedDate) => excludedDate.equals(date))) {
			return false;
		}

		if (Temporal.PlainDate.compare(date, this.startsOn) < 0 || Temporal.PlainDate.compare(date, this.endsOn) > 0) {
			return false;
		}

		return this.days[(date.dayOfWeek - 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6];
	}

	runsOnOrAfter(date: Temporal.PlainDate) {
		if (this.includedDates.some((includedDate) => Temporal.PlainDate.compare(includedDate, date) >= 0)) {
			return true;
		}

		if (!this.days.includes(true)) return false;

		let current = Temporal.PlainDate.compare(date, this.startsOn) < 0 ? this.startsOn : date;
		while (Temporal.PlainDate.compare(current, this.endsOn) <= 0) {
			if (this.runsOn(current)) return true;
			current = current.add({ days: 1 });
		}
		return false;
	}
}

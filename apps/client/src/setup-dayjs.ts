import dayjs from "dayjs";

import durationPlugin from "dayjs/plugin/duration";
import localizedFormatPlugin from "dayjs/plugin/localizedFormat";
import relativeTimePlugin from "dayjs/plugin/relativeTime";
import updateLocalePlugin from "dayjs/plugin/updateLocale";

import frenchLocale from "dayjs/locale/fr";
import "dayjs/locale/en";

dayjs.extend(durationPlugin);
dayjs.extend(localizedFormatPlugin);
dayjs.extend(updateLocalePlugin);

dayjs.extend(relativeTimePlugin, {
	thresholds: [
		{ l: "s", r: 1 },
		{ l: "ss", r: 59, d: "second" },
		{ l: "m", r: 1 },
		{ l: "mm", r: 59, d: "minute" },
		{ l: "h", r: 1 },
		{ l: "hh", r: 23, d: "hour" },
		{ l: "d", r: 1 },
		{ l: "dd", r: 29, d: "day" },
		{ l: "M", r: 1 },
		{ l: "MM", r: 11, d: "month" },
		{ l: "y", r: 1 },
		{ l: "yy", d: "year" },
	],
	rounding: Math.floor,
});

dayjs.updateLocale("fr", {
	relativeTime: {
		...frenchLocale.relativeTime,
		s: "%d seconde",
		ss: "%d secondes",
	},
});

dayjs.locale(navigator.language);

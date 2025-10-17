import dayjs from "dayjs";

import durationPlugin from "dayjs/plugin/duration";
import localizedFormatPlugin from "dayjs/plugin/localizedFormat";
import relativeTimePlugin from "dayjs/plugin/relativeTime";
import updateLocalePlugin from "dayjs/plugin/updateLocale";
import timezonePlugin from "dayjs/plugin/timezone";
import utcPlugin from "dayjs/plugin/utc";

import frenchLocale from "dayjs/locale/fr";
import "dayjs/locale/en";

dayjs.extend(durationPlugin);
dayjs.extend(localizedFormatPlugin);
dayjs.extend(relativeTimePlugin);
dayjs.extend(updateLocalePlugin);
dayjs.extend(timezonePlugin);
dayjs.extend(utcPlugin);

dayjs.updateLocale("fr", {
	relativeTime: {
		...frenchLocale.relativeTime,
		s: "%d secondes",
	},
});

dayjs.locale(navigator.language);

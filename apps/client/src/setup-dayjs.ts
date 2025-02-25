import dayjs from "dayjs";

import durationPlugin from "dayjs/plugin/duration";
import localizedFormatPlugin from "dayjs/plugin/localizedFormat";
import updateLocalePlugin from "dayjs/plugin/updateLocale";

import frenchLocale from "dayjs/locale/fr";
import "dayjs/locale/en";

dayjs.extend(durationPlugin);
dayjs.extend(localizedFormatPlugin);
dayjs.extend(updateLocalePlugin);

dayjs.updateLocale("fr", {
	relativeTime: {
		...frenchLocale.relativeTime,
		s: "%d secondes",
	},
});

dayjs.locale(navigator.language);

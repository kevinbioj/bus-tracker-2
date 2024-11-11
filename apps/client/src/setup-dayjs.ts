import dayjs from "dayjs";

import localizedFormatPlugin from "dayjs/plugin/localizedFormat";
import relativeTimePlugin from "dayjs/plugin/relativeTime";
import updateLocalePlugin from "dayjs/plugin/updateLocale";

import frenchLocale from "dayjs/locale/fr";
import "dayjs/locale/en";

dayjs.extend(localizedFormatPlugin);
dayjs.extend(relativeTimePlugin);
dayjs.extend(updateLocalePlugin);

dayjs.updateLocale("fr", {
	relativeTime: {
		...frenchLocale.relativeTime,
		s: "%d secondes",
	},
});

dayjs.locale(navigator.language);

import dayjs from "dayjs";

import localizedFormatPlugin from "dayjs/plugin/localizedFormat";
import relativeTimePlugin from "dayjs/plugin/relativeTime";
import updateLocalePlugin from "dayjs/plugin/updateLocale";

import frenchLocale from "dayjs/locale/fr";
import "dayjs/locale/en";

dayjs.extend(localizedFormatPlugin);
dayjs.extend(relativeTimePlugin);
dayjs.extend(updateLocalePlugin);

const customLocale = structuredClone(frenchLocale.relativeTime);

for (const key in customLocale) {
	const entryKey = key as keyof typeof customLocale;
	customLocale[entryKey] = `il y a ${customLocale[entryKey]}`;
}

dayjs.updateLocale("fr", {
	relativeTime: {
		...customLocale,
		s: (seconds: number) => (seconds < 10 ? "à l'instant" : `il y a ${seconds} secondes`),
	},
});

dayjs.locale(navigator.language);

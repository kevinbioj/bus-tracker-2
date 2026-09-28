import type { TranslatedImage, TranslatedText } from "@bus-tracker/contracts";

import { getLocale } from "~/paraglide/runtime";

/**
 * Traduction dans la langue de l'interface, à défaut celle qui ne déclare aucune langue — la valeur
 * par défaut au sens de GTFS-RT — et à défaut la première venue.
 */
function pickLocalized<T extends { language?: string }>(values?: T[]) {
	if (values === undefined || values.length === 0) return undefined;

	const locale = getLocale();
	const matches = (language?: string) => language?.toLowerCase().split(/[-_]/)[0] === locale;

	return (
		values.find(({ language }) => matches(language)) ??
		values.find(({ language }) => language === undefined) ??
		values[0]
	);
}

export function pickTranslation(value?: TranslatedText) {
	return pickLocalized(value)?.text;
}

export function pickImage(value?: TranslatedImage) {
	return pickLocalized(value)?.url;
}

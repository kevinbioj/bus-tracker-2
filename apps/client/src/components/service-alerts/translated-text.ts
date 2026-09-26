import type { TranslatedText } from "@bus-tracker/contracts";

import { getLocale } from "~/paraglide/runtime";

/**
 * Traduction dans la langue de l'interface, à défaut celle qui ne déclare aucune langue — le texte
 * par défaut au sens de GTFS-RT — et à défaut la première venue.
 */
export function pickTranslation(value?: TranslatedText) {
	if (value === undefined || value.length === 0) return undefined;

	const locale = getLocale();
	const matches = (language?: string) => language?.toLowerCase().split(/[-_]/)[0] === locale;

	return (
		value.find(({ language }) => matches(language)) ??
		value.find(({ language }) => language === undefined) ??
		value[0]
	)?.text;
}

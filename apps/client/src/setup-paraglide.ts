import type { Locale } from "./paraglide/runtime";
import {
	baseLocale,
	extractLocaleFromNavigator,
	getLocale,
	isLocale,
	localStorageKey,
	overwriteGetLocale,
	overwriteSetLocale,
} from "./paraglide/runtime";

const localePreferenceKey = "bus-tracker-locale-preference";

export type LocalePreference = Locale | "system";

export const getLocalePreference = (): LocalePreference => {
	if (typeof window === "undefined") return "system";

	const storedPreference = localStorage.getItem(localePreferenceKey);
	if (isLocale(storedPreference)) return storedPreference;

	return "system";
};

export const setSystemLocalePreference = () => {
	if (typeof window === "undefined") return;

	const previousLocale = getLocale();
	localStorage.removeItem(localePreferenceKey);
	localStorage.removeItem(localStorageKey);

	if (getLocale() !== previousLocale) {
		window.location.reload();
	}
};

const resolveLocale = (): Locale => {
	if (typeof window === "undefined") return baseLocale;

	const storedPreference = localStorage.getItem(localePreferenceKey);
	if (isLocale(storedPreference)) return storedPreference;

	return extractLocaleFromNavigator() ?? baseLocale;
};

overwriteGetLocale(resolveLocale);

overwriteSetLocale((newLocale, options) => {
	if (typeof window === "undefined") return;

	const previousLocale = getLocale();
	localStorage.setItem(localePreferenceKey, newLocale);
	localStorage.setItem(localStorageKey, newLocale);

	if ((options?.reload ?? true) && newLocale !== previousLocale) {
		window.location.reload();
	}
});

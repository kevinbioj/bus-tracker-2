import { useCallback } from "react";
import { useLocalStorage } from "usehooks-ts";

/** Code pays ISO 3166-1 alpha-2, tel que porté par les réseaux côté API. */
export type CountryCode = string;

/** Même défaut que la colonne `network.country_code` côté serveur. */
export const fallbackCountryCode: CountryCode = "FR";

// Les utilisateurs historiques suivent des réseaux français : les véhicules des autres pays
// n'apparaissent qu'une fois explicitement activés.
export const defaultCountryCodes: CountryCode[] = [fallbackCountryCode];

/**
 * Un réseau servi par une API antérieure à la colonne `country_code` n'a pas de code pays :
 * tout ce qui n'est pas un alpha-2 est ignoré plutôt que propagé jusqu'à l'affichage.
 */
export function isCountryCode(value: unknown): value is CountryCode {
	return typeof value === "string" && /^[A-Z]{2}$/.test(value);
}

/** Aligne le client sur le serveur : un réseau sans code pays exploitable est réputé français. */
export function resolveCountryCode(value: unknown): CountryCode {
	return isCountryCode(value) ? value : fallbackCountryCode;
}

/**
 * Prédicat partagé par toutes les listes de réseaux, pour qu'elles restent cohérentes avec les
 * véhicules affichés sur la carte.
 */
export function useIsCountryDisplayed() {
	const [displayedCountryCodes] = useDisplayedCountryCodes();

	return useCallback(
		(countryCode: unknown) => displayedCountryCodes.includes(resolveCountryCode(countryCode)),
		[displayedCountryCodes],
	);
}

const parse = (raw: string | null): CountryCode[] | undefined => {
	if (raw === null) return undefined;

	try {
		const parsed: unknown = JSON.parse(raw);
		if (!Array.isArray(parsed)) return undefined;

		const codes = parsed.filter(isCountryCode);
		return codes.length > 0 ? codes : undefined;
	} catch {
		// valeur corrompue : on retombe sur le comportement par défaut
		return undefined;
	}
};

export function readDisplayedCountryCodes(): CountryCode[] {
	return parse(localStorage.getItem("displayed-countries")) ?? defaultCountryCodes;
}

export function useDisplayedCountryCodes() {
	const [storedCountryCodes, setStoredCountryCodes] = useLocalStorage<CountryCode[] | undefined>(
		"displayed-countries",
		undefined,
	);

	return [storedCountryCodes ?? defaultCountryCodes, setStoredCountryCodes] as const;
}

export function getCountryName(countryCode: CountryCode, locale: string): string {
	try {
		return new Intl.DisplayNames([locale], { type: "region" }).of(countryCode) ?? countryCode;
	} catch {
		// Code inconnu d'Intl : on affiche le code brut plutôt que de casser le rendu.
		return countryCode;
	}
}

const REGIONAL_INDICATOR_OFFSET = 0x1f1e6 - "A".charCodeAt(0);

/**
 * Drapeau emoji construit à partir des deux indicateurs régionaux du code alpha-2. Les plateformes
 * qui ne dessinent pas les drapeaux (Windows) affichent les deux lettres, ce qui reste lisible.
 */
export function getCountryFlag(countryCode: CountryCode): string {
	return String.fromCodePoint(
		...Array.from(countryCode.toUpperCase(), (letter) => letter.charCodeAt(0) + REGIONAL_INDICATOR_OFFSET),
	);
}

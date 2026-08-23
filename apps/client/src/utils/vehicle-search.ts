import type { Vehicle } from "~/api/vehicles";
import { filterItems, type SearchField } from "~/utils/search";

/** Champs comparés : le numéro de parc prime, la désignation aide à retrouver un modèle. */
const VEHICLE_FIELDS: ReadonlyArray<SearchField<Vehicle>> = [
	{ pick: (vehicle) => vehicle.number, weight: 1 },
	{ pick: (vehicle) => vehicle.designation, weight: 0.9 },
];

/**
 * Caractères qui font basculer la saisie en motif : le joker `_` (un chiffre) et la syntaxe des
 * expressions régulières, historiquement acceptés dans ce champ.
 */
const PATTERN_CHARACTERS = /[_.*+?[\]()|^$\\{}]/;

/** La saisie doit-elle être interprétée comme un motif plutôt que comme une recherche en langage naturel ? */
export function isPatternQuery(query: string) {
	return PATTERN_CHARACTERS.test(query);
}

function buildPattern(query: string) {
	try {
		return new RegExp(query.replaceAll("_", "\\d"), "i");
	} catch {
		return null;
	}
}

/**
 * Filtre des véhicules sans en modifier l'ordre : le tri reste celui choisi par l'usager. Une saisie
 * contenant un joker ou une expression régulière conserve le comportement historique ; sinon la
 * recherche tolère casse, accents et termes multiples. La correspondance approximative est écartée,
 * une subséquence de chiffres n'ayant pas de sens sur un numéro de parc.
 */
export function filterVehicles<T extends Vehicle>(vehicles: T[], query: string): T[] {
	if (query.length === 0) {
		return vehicles;
	}

	if (isPatternQuery(query)) {
		const pattern = buildPattern(query);
		return pattern === null
			? vehicles.filter((vehicle) => vehicle.number.includes(query))
			: vehicles.filter((vehicle) => pattern.test(vehicle.number) || pattern.test(vehicle.designation ?? ""));
	}

	return filterItems(vehicles, query, VEHICLE_FIELDS as ReadonlyArray<SearchField<T>>, { allowFuzzy: false });
}

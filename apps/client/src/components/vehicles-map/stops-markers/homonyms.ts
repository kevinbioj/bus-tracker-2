import { normalizeSearchText } from "~/utils/search";

/** Mots qui ne suffisent pas à rapprocher deux noms : « de la République » n'en dit rien. */
const STOP_WORDS = new Set(["a", "au", "aux", "d", "de", "des", "du", "en", "et", "l", "la", "le", "les", "sur"]);

/**
 * Suite de segments d'un nom. `strong` : elle suffit à elle seule à rapprocher deux noms — c'est le nom
 * entier, ou une fin de nom d'au moins deux mots significatifs.
 */
type NamePart = { key: string; strong: boolean };

/**
 * Parties d'un nom, découpé en segments aux tirets, barres et parenthèses : « Gare-Rue Verte » donne
 * « gare », « rue verte » et « gare rue verte ».
 */
function namePartsOf(name: string): NamePart[] {
	const segments = normalizeSearchText(name)
		.split(/[-–—/(),;]+/)
		.map((segment) => segment.split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 0))
		.filter((words) => words.length > 0);

	const parts = new Map<string, boolean>();
	for (let start = 0; start < segments.length; start += 1) {
		for (let end = start + 1; end <= segments.length; end += 1) {
			const words = segments.slice(start, end).flat();
			const whole = start === 0 && end === segments.length;
			const suffix = end === segments.length;
			const strong = whole || (suffix && words.filter((word) => !STOP_WORDS.has(word)).length >= 2);

			const key = words.join(" ");
			parts.set(key, (parts.get(key) ?? false) || strong);
		}
	}
	return [...parts].map(([key, strong]) => ({ key, strong }));
}

const METERS_PER_DEGREE_OF_LATITUDE = 111_320;

type NamedStop = { name: string; networkId: number; latitude: number; longitude: number };

/** Distance approchée entre deux arrêts, en mètres : sur quelques centaines de mètres, le plan suffit. */
function distanceBetween(a: NamedStop, b: NamedStop) {
	const latitudeDelta = a.latitude - b.latitude;
	const longitudeDelta = (a.longitude - b.longitude) * Math.cos(((a.latitude + b.latitude) / 2) * (Math.PI / 180));
	return Math.hypot(latitudeDelta, longitudeDelta) * METERS_PER_DEGREE_OF_LATITUDE;
}

type Entry<T> = { stop: T; strong: boolean };

/**
 * Arrêts dont un homonyme d'un autre réseau figure parmi `stops`, à moins de `maxDistance` mètres :
 * leur nom seul ne dit pas lequel est lequel.
 *
 * Deux noms sont homonymes lorsqu'ils partagent une suite de segments qui, pour l'un d'eux au moins,
 * est le nom entier ou une fin de nom assez parlante : « Gare-Rue Verte » et « ROUEN - Rue Verte »,
 * « Mairie » et « Bihorel - Mairie », mais ni « Rue de la République » et « Place de la République »,
 * ni « Mont-Saint-Aignan - Gare » et « Mont-Saint-Aignan - Mairie ».
 */
export function findHomonyms<T extends NamedStop>(stops: T[], maxDistance = Number.POSITIVE_INFINITY) {
	// Une partie faible ne rapproche que d'une partie forte : seules celles-ci sont cherchées parmi
	// toutes. Les préfixes de commune, partagés par des centaines d'arrêts, restent ainsi bon marché.
	const entriesByKey = new Map<string, Entry<T>[]>();
	const strongEntriesByKey = new Map<string, Entry<T>[]>();
	const homonyms = new Set<T>();

	for (const stop of stops) {
		const parts = namePartsOf(stop.name);

		for (const { key, strong } of parts) {
			for (const other of (strong ? entriesByKey : strongEntriesByKey).get(key) ?? []) {
				if (other.stop.networkId === stop.networkId) continue;
				if (distanceBetween(stop, other.stop) > maxDistance) continue;
				homonyms.add(stop);
				homonyms.add(other.stop);
			}
		}

		for (const { key, strong } of parts) {
			const entry = { stop, strong };
			for (const index of strong ? [entriesByKey, strongEntriesByKey] : [entriesByKey]) {
				const entries = index.get(key) ?? [];
				entries.push(entry);
				index.set(key, entries);
			}
		}
	}

	return homonyms;
}

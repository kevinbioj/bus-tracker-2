/** Les ligatures ne sont pas décomposées par la normalisation Unicode : « Cœur » doit répondre à « coeur ». */
const LIGATURES: ReadonlyArray<[RegExp, string]> = [
	[/œ/g, "oe"],
	[/æ/g, "ae"],
	[/ß/g, "ss"],
	[/ø/g, "o"],
	[/đ|ð/g, "d"],
	[/ł/g, "l"],
];

/** Retire la casse, les ligatures et les diacritiques afin de comparer « Métro » et « metro ». */
export function normalizeSearchText(value: string) {
	const lowercased = LIGATURES.reduce(
		(text, [pattern, replacement]) => text.replace(pattern, replacement),
		value.toLowerCase(),
	);

	return lowercased
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.trim();
}

/** Découpe une chaîne normalisée en mots (« ligne 12b » -> [« ligne », « 12b »]). */
function splitWords(value: string) {
	return value.split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 0);
}

/** Isole les groupes de lettres et de chiffres afin que « c1 » corresponde aussi à « C 1 ». */
function splitChunks(value: string) {
	return value.match(/\p{L}+|\p{N}+/gu) ?? [];
}

/** « 007 » et « 7 » désignent la même ligne pour un usager. */
function canonicalize(value: string) {
	return /^\p{N}+$/u.test(value) ? value.replace(/^0+(?=\p{N})/u, "") : value;
}

const SCORE_FIELD_EXACT = 1000;
const SCORE_WORD_EXACT = 850;
const SCORE_FIELD_PREFIX = 700;
const SCORE_WORD_PREFIX = 550;
const SCORE_SUBSTRING = 350;
const SCORE_FUZZY_BASE = 100;

/**
 * Au-delà de ce facteur, les caractères trouvés sont trop dispersés pour être une faute de frappe :
 * « naolib » se retrouve lettre à lettre dans « Syndicat Mixte des Mobilités de l'Aire Grenobloise »
 * sans que l'usager y ait jamais pensé, alors que « grenoble » colle à « Grenobloise ».
 */
const MAX_FUZZY_SPAN_RATIO = 3;

/**
 * Correspondance approximative : tous les caractères de la requête apparaissent dans l'ordre et
 * suffisamment groupés dans le texte (« ctr » -> « centre »). Le score récompense les caractères
 * consécutifs et les débuts de mot.
 */
function scoreFuzzy(text: string, query: string) {
	if (query.length < 2) return 0;

	let textIndex = 0;
	let bonus = 0;
	let firstMatchIndex = -1;
	let previousMatchIndex = -2;

	for (const character of query) {
		const foundIndex = text.indexOf(character, textIndex);
		if (foundIndex === -1) return 0;

		if (firstMatchIndex === -1) firstMatchIndex = foundIndex;
		if (foundIndex === previousMatchIndex + 1) bonus += 6;
		if (foundIndex === 0 || !/[\p{L}\p{N}]/u.test(text[foundIndex - 1])) bonus += 4;

		previousMatchIndex = foundIndex;
		textIndex = foundIndex + 1;
	}

	// Une correspondance étalée sur toute une raison sociale relève du hasard, pas de la recherche.
	if (previousMatchIndex - firstMatchIndex + 1 > query.length * MAX_FUZZY_SPAN_RATIO) return 0;

	// Plus le texte est court par rapport à la requête, plus la correspondance est signifiante.
	const density = Math.round((query.length / text.length) * 40);
	return SCORE_FUZZY_BASE + Math.min(bonus, 60) + density;
}

/** Évalue à quel point un texte correspond à un terme de recherche (0 = aucune correspondance). */
export function scoreText(text: string, query: string) {
	if (text.length === 0) return 0;

	const canonicalText = canonicalize(text);
	const canonicalQuery = canonicalize(query);

	if (canonicalText === canonicalQuery) return SCORE_FIELD_EXACT;

	const parts = [...new Set([...splitWords(text), ...splitChunks(text)])];

	if (parts.some((part) => canonicalize(part) === canonicalQuery)) return SCORE_WORD_EXACT;
	if (text.startsWith(query)) return SCORE_FIELD_PREFIX;
	if (parts.some((part) => part.startsWith(query))) return SCORE_WORD_PREFIX;
	if (text.includes(query)) return SCORE_SUBSTRING;

	return scoreFuzzy(text, query);
}

/** Champ comparé lors d'une recherche, pondéré selon sa représentativité pour l'usager. */
export type SearchField<T> = {
	pick: (item: T) => string | null | undefined;
	weight: number;
	/**
	 * Autorise la correspondance approximative sur ce champ. À désactiver sur les libellés longs
	 * (raisons sociales, intitulés administratifs), où une subséquence quelconque produit du bruit.
	 * Par défaut, le réglage global de la recherche s'applique.
	 */
	allowFuzzy?: boolean;
};

export type SearchOptions = {
	/**
	 * Autorise la correspondance approximative. À désactiver sur des données majoritairement
	 * numériques, où une subséquence (« 123 » dans « 1928354 ») n'a aucun sens pour l'usager.
	 */
	allowFuzzy?: boolean;
};

/** Découpe la saisie de l'usager en termes normalisés (« bus 12 » -> [« bus », « 12 »]). */
export function parseSearchTerms(query: string) {
	return splitWords(normalizeSearchText(query));
}

/**
 * Note un élément face aux termes de recherche : chaque terme doit correspondre à au moins un champ,
 * le score final étant la moyenne des meilleures correspondances. Renvoie 0 si l'élément ne correspond pas.
 */
export function scoreItem<T>(
	item: T,
	fields: ReadonlyArray<SearchField<T>>,
	terms: string[],
	{ allowFuzzy = true }: SearchOptions = {},
) {
	if (terms.length === 0) return 1;

	const texts = fields.flatMap((field) => {
		const value = field.pick(item);
		if (!value) return [];

		const { weight } = field;
		const fuzzy = field.allowFuzzy ?? allowFuzzy;
		const text = normalizeSearchText(value);
		// Variante sans séparateurs : « GX 337 » doit aussi répondre à « gx337 », légèrement pénalisée
		// pour rester derrière une correspondance sur le texte tel qu'il est écrit.
		const compacted = text.replace(/[^\p{L}\p{N}]+/gu, "");

		return compacted !== text && compacted.length > 0
			? [
					{ text, weight, fuzzy },
					{ text: compacted, weight: weight * 0.9, fuzzy },
				]
			: [{ text, weight, fuzzy }];
	});

	let total = 0;

	for (const term of terms) {
		let best = 0;
		for (const { text, weight, fuzzy } of texts) {
			const score = scoreText(text, term);
			if (!fuzzy && score < SCORE_SUBSTRING) continue;
			best = Math.max(best, score * weight);
		}

		if (best === 0) return 0;
		total += best;
	}

	return total / terms.length;
}

/**
 * Filtre puis ordonne des éléments par pertinence. À score égal, `compareTies` (s'il est fourni)
 * départage afin de conserver un ordre stable et signifiant. Une requête vide laisse la liste intacte.
 */
export function searchItems<T>(
	items: T[],
	query: string,
	fields: ReadonlyArray<SearchField<T>>,
	compareTies?: (a: T, b: T) => number,
	options?: SearchOptions,
): T[] {
	const terms = parseSearchTerms(query);
	if (terms.length === 0) return items;

	return items
		.flatMap((item) => {
			const score = scoreItem(item, fields, terms, options);
			return score > 0 ? [{ item, score }] : [];
		})
		.sort((a, b) => b.score - a.score || (compareTies?.(a.item, b.item) ?? 0))
		.map(({ item }) => item);
}

/**
 * Conserve les éléments correspondant à la recherche sans toucher à leur ordre : utile lorsque
 * l'usager pilote lui-même le tri de la liste.
 */
export function filterItems<T>(
	items: T[],
	query: string,
	fields: ReadonlyArray<SearchField<T>>,
	options?: SearchOptions,
): T[] {
	const terms = parseSearchTerms(query);
	if (terms.length === 0) return items;

	return items.filter((item) => scoreItem(item, fields, terms, options) > 0);
}

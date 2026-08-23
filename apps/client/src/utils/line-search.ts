import type { Line } from "~/api/networks";
import { type SearchField, searchItems } from "~/utils/search";

/** Champs comparés, du plus au moins représentatif de ce que l'usager connaît de la ligne. */
const LINE_FIELDS: ReadonlyArray<SearchField<Line>> = [
	{ pick: (line) => line.number, weight: 1 },
	{ pick: (line) => line.girouetteNumber, weight: 0.95 },
	{ pick: (line) => line.ref, weight: 0.5 },
];

/** À pertinence égale, les lignes en service passent devant, puis l'ordre naturel du réseau s'applique. */
function compareLineTies(a: Line, b: Line) {
	const onlineDiff = (b.onlineMarkerCount ?? 0) - (a.onlineMarkerCount ?? 0);
	if (onlineDiff !== 0) return onlineDiff;

	const sortOrderDiff = (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER);
	return sortOrderDiff || a.number.localeCompare(b.number, undefined, { numeric: true });
}

/** Filtre puis ordonne des lignes par pertinence. Une requête vide laisse la liste intacte. */
export function searchLines<T extends Line>(lines: T[], query: string): T[] {
	return searchItems(lines, query, LINE_FIELDS as ReadonlyArray<SearchField<T>>, compareLineTies);
}

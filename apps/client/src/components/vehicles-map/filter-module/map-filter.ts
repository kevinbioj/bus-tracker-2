import { parseAsArrayOf, parseAsInteger } from "nuqs";

import type { Line, Network } from "~/api/networks";

// Le filtre de la carte est soit une sélection de lignes d'un même réseau (le réseau n'est là que pour le
// fil d'Ariane), soit un réseau entier. Modéliser une union évite l'état impossible « réseau connu mais rien
// de filtré », qui se produit en mode embarqué où le réseau est toujours défini.
export type MapFilter = { kind: "line"; network?: Network; lines: Line[] } | { kind: "network"; network: Network };

export const MAX_FILTERED_LINES = 50;

export const lineIdsSearchParser = parseAsArrayOf(parseAsInteger);

export function resolveFilteredLines(lines: Line[], lineIds: number[] | null) {
	if (lineIds === null) return [];
	const selectedIds = new Set(lineIds);
	return lines.filter((line) => selectedIds.has(line.id));
}

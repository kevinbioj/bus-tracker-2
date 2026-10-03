import type { VehicleJourneyLine } from "@bus-tracker/contracts";
import { sql } from "drizzle-orm";

import { database } from "../../core/database/database.js";
import { type LineEntity, linesTable, type NetworkEntity } from "../../core/database/schema.js";
import { mapRowsToEntity } from "../../core/database/utils.js";
import { useCache } from "../../utils/use-cache.js";
import { REFERENCE_CACHE_TTL_MS } from "./reference-cache.js";

/** Lignes par réseau et par référence. */
const lineCache = useCache<LineEntity>(REFERENCE_CACHE_TTL_MS);
const cacheKey = (networkId: number, ref: string) => `${networkId}|${ref}`;

/**
 * Lignes des références données, créées si besoin, indexées par référence. Seules les références
 * absentes du cache sont soumises à la base.
 */
export async function importLines(
	network: NetworkEntity,
	linesData: VehicleJourneyLine[],
	recordedAt: Temporal.Instant,
) {
	const lines = new Map<string, LineEntity>();
	const unknownLines: VehicleJourneyLine[] = [];

	for (const lineData of linesData) {
		const cached = lineCache.get(cacheKey(network.id, lineData.ref));
		if (cached !== undefined) {
			lines.set(lineData.ref, cached);
		} else {
			unknownLines.push(lineData);
		}
	}

	if (unknownLines.length === 0) return lines;

	// Un seul paramètre, quelle que soit la taille du lot : le texte de la requête ne varie pas, et la
	// limite de paramètres d'une requête PostgreSQL ne peut pas être atteinte.
	// Clés attendues par `import_lines(integer, jsonb, timestamp)` (migration 0030).
	const input = JSON.stringify(
		unknownLines.map((l) => ({ ref: l.ref, number: l.number, color: l.color, textColor: l.textColor })),
	);
	const rows = await database.execute(
		sql`SELECT * FROM public.import_lines(${network.id}::integer, ${input}::jsonb, ${recordedAt.toString()}::timestamp)`,
	);

	// Une ligne répond de toutes ses références, pas seulement de celles demandées.
	for (const line of mapRowsToEntity(linesTable, rows)) {
		for (const ref of line.references ?? []) {
			lineCache.set(cacheKey(network.id, ref), line);
			lines.set(ref, line);
		}
	}

	return lines;
}

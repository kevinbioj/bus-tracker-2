import { arrayOverlaps, eq } from "drizzle-orm";
import { createRefResolver } from "../../utils/create-ref-resolver.js";
import { database } from "../database/database.js";
import { linesTable } from "../database/schema.js";

export type ResolvedLine = { id: number; networkId: number };

/** Références de chaque ligne, dans l'autre sens : celles d'une ligne filtrée sur la carte. */
const refsByLineId = new Map<number, string[]>();

setInterval(() => refsByLineId.clear(), 30 * 60_000).unref();

/** Ligne par référence. Une référence partagée par plusieurs lignes désigne celle qui n'est pas archivée. */
export const resolveLineRefs = createRefResolver<ResolvedLine>(async (refs) => {
	const lines = await database
		.select({
			id: linesTable.id,
			networkId: linesTable.networkId,
			references: linesTable.references,
			archivedAt: linesTable.archivedAt,
		})
		.from(linesTable)
		// Les références de ligne portent leur réseau en préfixe : elles suffisent à la désigner.
		.where(arrayOverlaps(linesTable.references, refs));

	const resolved = new Map<string, ResolvedLine>();
	for (const ref of refs) {
		const candidates = lines.filter(({ references }) => references?.includes(ref));
		const line =
			candidates.find(({ archivedAt }) => archivedAt === null) ??
			candidates.toSorted((a, b) => b.archivedAt!.epochMilliseconds - a.archivedAt!.epochMilliseconds).at(0);
		if (line !== undefined) resolved.set(ref, { id: line.id, networkId: line.networkId });
	}
	return resolved;
});

/**
 * Références d'une ligne, sous la forme des `lineRef` des passages et des `lineRefs` des stations.
 * Une ligne inconnue n'en a aucune : rien ne s'y rapporte.
 */
export async function findLineRefs(lineId: number) {
	let refs = refsByLineId.get(lineId);
	if (refs === undefined) {
		const [line] = await database
			.select({ references: linesTable.references })
			.from(linesTable)
			.where(eq(linesTable.id, lineId));
		refs = line?.references ?? [];
		if (refs.length > 0) refsByLineId.set(lineId, refs);
	}
	return refs;
}

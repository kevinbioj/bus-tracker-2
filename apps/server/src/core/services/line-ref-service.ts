import { arrayOverlaps } from "drizzle-orm";

import { database } from "../database/database.js";
import { linesTable } from "../database/schema.js";

export type ResolvedLine = { id: number; networkId: number };

/**
 * Ligne par référence. Une référence ne change pas de ligne : la table est gardée en mémoire et
 * seules les références encore inconnues sont cherchées en base, une requête au plus par appel.
 */
const linesByRef = new Map<string, ResolvedLine>();

/**
 * Références restées sans ligne, et l'instant où les chercher de nouveau. La ligne naît de la
 * première course publiée : l'attendre une demi-heure laisserait le passage sans pictogramme bien
 * après qu'elle existe. Une minute épargne tout de même la base à chaque rafraîchissement.
 */
const unknownLineRefsUntil = new Map<string, number>();

/** Oubli périodique des correspondances, pour suivre une ligne recréée ou fusionnée par un éditeur. */
setInterval(() => {
	linesByRef.clear();
	unknownLineRefsUntil.clear();
}, 30 * 60_000).unref();

const UNKNOWN_LINE_RETRY_MS = 60_000;

/** Lignes connues parmi les références demandées. Une référence sans ligne est absente du résultat. */
export async function resolveLineRefs(refs: Iterable<string>) {
	const nowMs = Date.now();
	const requestedRefs = [...new Set(refs)];
	const unknownRefs = requestedRefs.filter(
		(ref) => !linesByRef.has(ref) && (unknownLineRefsUntil.get(ref) ?? 0) <= nowMs,
	);

	if (unknownRefs.length > 0) {
		const lines = await database
			.select({ id: linesTable.id, networkId: linesTable.networkId, references: linesTable.references })
			.from(linesTable)
			// Les références de ligne portent leur réseau en préfixe : elles suffisent à la désigner.
			.where(arrayOverlaps(linesTable.references, unknownRefs));

		for (const ref of unknownRefs) {
			const line = lines.find(({ references }) => references?.includes(ref));
			if (line !== undefined) {
				linesByRef.set(ref, { id: line.id, networkId: line.networkId });
				unknownLineRefsUntil.delete(ref);
			} else {
				unknownLineRefsUntil.set(ref, nowMs + UNKNOWN_LINE_RETRY_MS);
			}
		}
	}

	const resolved = new Map<string, ResolvedLine>();
	for (const ref of requestedRefs) {
		const line = linesByRef.get(ref);
		if (line !== undefined) resolved.set(ref, line);
	}
	return resolved;
}

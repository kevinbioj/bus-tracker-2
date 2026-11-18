/** Oubli périodique des correspondances, pour suivre une entité recréée ou fusionnée par un éditeur. */
const RESET_INTERVAL_MS = 30 * 60_000;

/**
 * Une référence restée sans correspondance est cherchée de nouveau après ce délai : l'entité naît de
 * la première course publiée, et l'attendre jusqu'à l'oubli périodique la laisserait introuvable bien
 * après qu'elle existe. Une minute épargne tout de même la base à chaque rafraîchissement.
 */
const UNKNOWN_RETRY_MS = 60_000;

/**
 * Correspondance référence → entité tenue en mémoire : une référence ne change pas d'entité, seules
 * celles encore inconnues sont cherchées, une recherche au plus par appel.
 */
export function createRefResolver<T>(lookup: (refs: string[]) => Promise<Map<string, T>>) {
	const known = new Map<string, T>();
	const unknownUntil = new Map<string, number>();

	setInterval(() => {
		known.clear();
		unknownUntil.clear();
	}, RESET_INTERVAL_MS).unref();

	/** Correspondances connues parmi les références demandées : une référence sans entité en est absente. */
	return async (refs: Iterable<string>) => {
		const nowMs = Date.now();
		const requestedRefs = [...new Set(refs)];
		const unknownRefs = requestedRefs.filter((ref) => !known.has(ref) && (unknownUntil.get(ref) ?? 0) <= nowMs);

		if (unknownRefs.length > 0) {
			const found = await lookup(unknownRefs);
			for (const ref of unknownRefs) {
				const value = found.get(ref);
				if (value !== undefined) {
					known.set(ref, value);
					unknownUntil.delete(ref);
				} else {
					unknownUntil.set(ref, nowMs + UNKNOWN_RETRY_MS);
				}
			}
		}

		const resolved = new Map<string, T>();
		for (const ref of requestedRefs) {
			const value = known.get(ref);
			if (value !== undefined) resolved.set(ref, value);
		}
		return resolved;
	};
}

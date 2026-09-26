import type { Source } from "../model/source.js";

/**
 * Réseaux connus de la source. Les refs observées priment ; à défaut, une configuration dont
 * {@link Source.options.getNetworkRef} est constante répond sans course et permet d'annoncer la
 * source dès le démarrage. Une configuration dépendant de la course renvoie `undefined` ou lève,
 * auquel cas la source attend sa première publication de véhicule pour en avoir.
 */
export function resolveSourceNetworkRefs(source: Source) {
	const networkRefs = new Set(source.observedNetworkRefs);

	if (networkRefs.size === 0) {
		try {
			const networkRef = source.options.getNetworkRef();
			if (typeof networkRef === "string" && networkRef.length > 0) {
				networkRefs.add(networkRef);
			}
		} catch {
			// Configuration dépendant de la course : rien à déduire hors contexte.
		}
	}

	return [...networkRefs].sort();
}

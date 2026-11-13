import { createHash } from "node:crypto";

import { Shape } from "../model/shape.js";

/** Seule l'écriture est requise : évite d'exposer la variance des types du client Redis. */
type RedisWriter = { set: (key: string, value: string, options: { EX: number }) => Promise<unknown> };

export type JourneyPathPublisher = {
	/**
	 * Écrit les tracés nouveaux ou modifiés depuis le dernier cycle, et ceux dont l'expiration
	 * approche. Les autres sont déjà en place dans Redis : les réécrire à chaque cycle ne ferait que
	 * resérialiser des tracés statiques.
	 */
	publish(redis: RedisWriter, paths: Record<string, object>, nowMs: number): Promise<void>;
	/** Oublie ce qui a été écrit : Redis a pu le perdre (reconnexion), tout sera réécrit. */
	reset(): void;
};

/**
 * @param ttlSeconds Durée de vie des tracés dans Redis.
 * @param refreshMs Âge au-delà duquel un tracé inchangé est réécrit, pour ne jamais expirer tant
 * qu'il reste référencé. Doit laisser, sous la durée de vie, la marge de plusieurs cycles.
 */
export function createJourneyPathPublisher(ttlSeconds: number, refreshMs: number): JourneyPathPublisher {
	const published = new Map<string, { source: object; digest: string; atMs: number }>();

	const serializePath = (path: object) => (path instanceof Shape ? path.toPathJson() : JSON.stringify(path));
	const digestOf = (payload: string) => createHash("sha1").update(payload).digest("base64");

	return {
		async publish(redis, paths, nowMs) {
			// Un tracé que plus rien ne référence a expiré de Redis : inutile de s'en souvenir.
			for (const [ref, { atMs }] of published) {
				if (nowMs - atMs >= ttlSeconds * 1000) published.delete(ref);
			}

			const writes: Promise<unknown>[] = [];
			for (const [ref, path] of Object.entries(paths)) {
				const previous = published.get(ref);
				const fresh = previous !== undefined && nowMs - previous.atMs < refreshMs;
				if (fresh && previous.source === path) continue;

				const payload = serializePath(path);
				const digest = digestOf(payload);
				if (fresh && previous.digest === digest) {
					published.set(ref, { source: path, digest, atMs: previous.atMs });
					continue;
				}

				// Émises sans s'attendre les unes les autres : le client Redis les envoie d'un seul tenant.
				writes.push(
					redis.set(ref, payload, { EX: ttlSeconds }).then(() => {
						published.set(ref, { source: path, digest, atMs: nowMs });
					}),
				);
			}
			await Promise.all(writes);
		},

		reset() {
			published.clear();
		},
	};
}

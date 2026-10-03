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
	// Les tracés de course (`Shape.asPath`) et les tracés abandonnés (`Journey.cancelledPath`) sont
	// mis en cache par leur producteur : un même objet d'un cycle à l'autre n'est sérialisé qu'une fois.
	const serialized = new WeakMap<object, string>();
	const published = new Map<string, { payload: string; atMs: number }>();

	const serialize = (path: object) => {
		let payload = serialized.get(path);
		if (payload === undefined) {
			payload = JSON.stringify(path);
			serialized.set(path, payload);
		}
		return payload;
	};

	return {
		async publish(redis, paths, nowMs) {
			// Un tracé que plus rien ne référence a expiré de Redis : inutile de s'en souvenir.
			for (const [ref, { atMs }] of published) {
				if (nowMs - atMs >= ttlSeconds * 1000) published.delete(ref);
			}

			const writes: Promise<unknown>[] = [];
			for (const [ref, path] of Object.entries(paths)) {
				const payload = serialize(path);
				const previous = published.get(ref);
				if (previous !== undefined && previous.payload === payload && nowMs - previous.atMs < refreshMs) continue;

				// Émises sans s'attendre les unes les autres : le client Redis les envoie d'un seul tenant.
				writes.push(
					redis.set(ref, payload, { EX: ttlSeconds }).then(() => {
						published.set(ref, { payload, atMs: nowMs });
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

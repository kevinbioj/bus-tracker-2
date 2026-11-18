export function useCache<T>(ttl: number, maxEntries = Number.POSITIVE_INFINITY) {
	const cache = new Map<string, { data: T; recordedAt: number }>();
	const loading = new Map<string, Promise<T>>();
	let lastSweepAt = Date.now();

	// Une entrée expirée n'est retirée à la lecture que si sa clé est redemandée : celles qu'on ne
	// relit jamais — un cadrage de carte, une station consultée une fois — sont balayées en bloc.
	const sweep = (now: number) => {
		if (now - lastSweepAt < ttl) return;
		lastSweepAt = now;
		for (const [key, entry] of cache) {
			if (now - entry.recordedAt >= ttl) cache.delete(key);
		}
	};

	const get = (key: string) => {
		const entry = cache.get(key);
		if (!entry) return undefined;
		if (Date.now() - entry.recordedAt >= ttl) {
			cache.delete(key);
			return undefined;
		}
		return entry.data;
	};

	const set = (key: string, value: T) => {
		const now = Date.now();
		sweep(now);
		cache.delete(key);
		if (cache.size >= maxEntries) {
			const oldestKey = cache.keys().next().value;
			if (oldestKey !== undefined) cache.delete(oldestKey);
		}
		cache.set(key, {
			data: value,
			recordedAt: now,
		});
	};

	return {
		get,
		set,
		/** Valeur en cache, à défaut chargée puis retenue ; des demandes simultanées partagent le même chargement. */
		getOrLoad: async (key: string, load: () => Promise<T>) => {
			const cached = get(key);
			if (cached !== undefined) return cached;

			let pending = loading.get(key);
			if (pending === undefined) {
				pending = load()
					.then((value) => {
						set(key, value);
						return value;
					})
					.finally(() => loading.delete(key));
				loading.set(key, pending);
			}
			return pending;
		},
		/** Oublie les entrées dont la valeur satisfait le prédicat. */
		deleteWhere: (predicate: (value: T) => boolean) => {
			for (const [key, entry] of cache) {
				if (predicate(entry.data)) cache.delete(key);
			}
		},
		clear: () => cache.clear(),
		get size() {
			return cache.size;
		},
	};
}

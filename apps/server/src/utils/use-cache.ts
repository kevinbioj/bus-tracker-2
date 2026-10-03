export function useCache<T>(ttl: number) {
	const cache = new Map<string, { data: T; recordedAt: number }>();
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

	return {
		get: (key: string) => {
			const entry = cache.get(key);
			if (!entry) return undefined;
			if (Date.now() - entry.recordedAt >= ttl) {
				cache.delete(key);
				return undefined;
			}
			return entry.data;
		},
		set: (key: string, value: T) => {
			const now = Date.now();
			sweep(now);
			cache.set(key, {
				data: value,
				recordedAt: now,
			});
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

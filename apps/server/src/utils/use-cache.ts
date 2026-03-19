export function useCache<T>(ttl: number) {
	const cache = new Map<string, { data: T; recordedAt: number }>();

	setInterval(() => {
		const now = Date.now();

		for (const [id, { recordedAt }] of cache) {
			const age = now - recordedAt;
			if (age >= ttl) {
				cache.delete(id);
			}
		}
	}, ttl);

	return {
		get: (key: string) => cache.get(key)?.data,
		set: (key: string, value: T) =>
			cache.set(key, {
				data: value,
				recordedAt: Date.now(),
			}),
		clear: () => cache.clear(),
	};
}

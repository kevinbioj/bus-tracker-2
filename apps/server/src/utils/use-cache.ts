export function useCache<T>(ttl: number) {
	const cache = new Map<string, { data: T; recordedAt: number }>();

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
		set: (key: string, value: T) =>
			cache.set(key, {
				data: value,
				recordedAt: Date.now(),
			}),
		clear: () => cache.clear(),
	};
}

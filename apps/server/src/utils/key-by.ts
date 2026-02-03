export function keyBy<T, K>(array: readonly T[], predicate: (item: T) => K | K[]) {
	const map = new Map<K, T>();

	for (const item of array) {
		const keys = predicate(item);
		if (Array.isArray(keys)) {
			for (const key of keys) {
				map.set(key, item);
			}
		} else {
			map.set(keys, item);
		}
	}

	return map;
}

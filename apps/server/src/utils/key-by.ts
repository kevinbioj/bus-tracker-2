export function keyBy<T, K>(
	array: Iterable<T>,
	predicate: (item: T) => K | K[],
	onDuplicate: "ignore" | "overwrite" = "overwrite",
) {
	const map = new Map<K, T>();

	for (const item of array) {
		const keys = predicate(item);
		if (Array.isArray(keys)) {
			for (const key of keys) {
				if (map.has(key) && onDuplicate === "ignore") {
					continue;
				}

				map.set(key, item);
			}
		} else {
			if (map.has(keys) && onDuplicate === "ignore") {
				continue;
			}

			map.set(keys, item);
		}
	}

	return map;
}

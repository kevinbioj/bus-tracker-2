if (typeof Map.groupBy === "undefined") {
	Map.groupBy = function groupBy<K, T>(items: Iterable<T>, keySelector: (item: T, index: number) => K) {
		const map = new Map<K, T[]>();
		let i = 0;
		for (const item of items) {
			const key = keySelector(item, i);

			let list = map.get(key);
			if (typeof list === "undefined") {
				list = [];
				map.set(key, list);
			}

			list.push(item);
			i += 1;
		}
		return map;
	};
}

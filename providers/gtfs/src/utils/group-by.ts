export const groupBy = <S, D extends string | number>(items: S[], predicate: (item: S) => D | undefined) => {
	// @ts-expect-error
	const obj: Record<D, S> = {};

	for (const item of items) {
		const key = predicate(item);

		if (key !== undefined) {
			obj[key] = item;
		}
	}

	return obj;
};

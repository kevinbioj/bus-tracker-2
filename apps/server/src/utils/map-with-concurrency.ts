/**
 * Applique `fn` à chaque élément, au plus `concurrency` à la fois. Les résultats suivent l'ordre des
 * éléments. Au premier rejet, plus aucun élément n'est entamé et le rejet est propagé.
 */
export async function mapWithConcurrency<T, R>(
	items: Iterable<T>,
	concurrency: number,
	fn: (item: T) => Promise<R>,
): Promise<R[]> {
	const list = Array.from(items);
	const results = new Array<R>(list.length);
	let next = 0;
	let failed = false;

	const run = async () => {
		while (!failed && next < list.length) {
			const index = next++;
			try {
				results[index] = await fn(list[index]!);
			} catch (error) {
				failed = true;
				throw error;
			}
		}
	};

	await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, run));
	return results;
}

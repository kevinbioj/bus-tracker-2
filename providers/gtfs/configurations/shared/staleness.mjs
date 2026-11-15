export async function isPysaeStale(resource, { fetchFreshness }) {
	return (await fetchFreshness("GET")).etag !== resource.etag;
}

export async function isZenbusStale(resource, { fetchFreshness }) {
	const { lastModified } = await fetchFreshness();
	return Date.parse(lastModified ?? "") !== Date.parse(resource.lastModified ?? "");
}

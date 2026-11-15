export async function isPysaeStale(resource, { href }) {
	const groupId = /\/groups\/([^/]+)\/gtfs/.exec(href)?.[1];
	if (groupId === undefined) throw new Error(`No Pysae group in '${href}'.`);

	const response = await fetch(`${new URL(href).origin}/api/v4/groups/${groupId}/gtfs`, {
		signal: AbortSignal.timeout(30_000),
	});
	if (!response.ok) throw new Error(`Unable to list Pysae GTFS of '${groupId}' (status ${response.status}).`);

	const current = (await response.json())
		.filter((gtfs) => gtfs.published !== null)
		.reduce((latest, gtfs) => (latest === undefined || gtfs.published > latest.published ? gtfs : latest), undefined);
	if (current === undefined) throw new Error(`No published Pysae GTFS for '${groupId}'.`);

	return Math.floor(Date.parse(current.mod_time) / 1000) * 1000 !== Date.parse(resource.lastModified ?? "");
}

export async function isZenbusStale(resource, { fetchFreshness }) {
	const { lastModified } = await fetchFreshness();
	return Date.parse(lastModified ?? "") !== Date.parse(resource.lastModified ?? "");
}

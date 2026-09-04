import * as z from "zod";

import { database } from "../core/database/database.js";
import { type DataSourceEntity, type NetworkEntity, networksTable } from "../core/database/schema.js";
import { getFreshDataSources } from "../core/services/data-source-service.js";
import { hono } from "../server.js";
import { useCache } from "../utils/use-cache.js";
import { createParamValidator } from "../utils/validator-helpers.js";

type NetworkDataSources = {
	network: NetworkEntity;
	sources: DataSourceEntity[];
};

const getNetworkDataSourcesParamSchema = z.object({
	id: z.coerce.number().min(0),
});

/** L'inventaire ne bouge qu'au rythme des publications des providers : un cache court suffit. */
const dataSourcesCache = useCache<NetworkDataSources[]>(60_000);
const CACHE_KEY = "data-sources";

async function getNetworkDataSources() {
	const cached = dataSourcesCache.get(CACHE_KEY);
	if (cached !== undefined) return cached;

	const [networkList, dataSourceList] = await Promise.all([
		database.select().from(networksTable),
		getFreshDataSources(),
	]);

	const networksByRef = new Map(networkList.map((network) => [network.ref, network]));
	const sourcesByNetworkId = new Map<number, DataSourceEntity[]>();

	for (const dataSource of dataSourceList) {
		// Une source alimentant plusieurs réseaux est créditée sous chacun d'eux.
		for (const networkRef of dataSource.networkRefs) {
			const network = networksByRef.get(networkRef);
			if (network === undefined) continue;

			const sources = sourcesByNetworkId.get(network.id);
			if (sources === undefined) {
				sourcesByNetworkId.set(network.id, [dataSource]);
			} else if (!sources.includes(dataSource)) {
				sources.push(dataSource);
			}
		}
	}

	const networkDataSources = networkList
		.flatMap((network) => {
			const sources = sourcesByNetworkId.get(network.id);
			return sources === undefined ? [] : [{ network, sources }];
		})
		.sort((a, b) => a.network.name.localeCompare(b.network.name));

	dataSourcesCache.set(CACHE_KEY, networkDataSources);
	return networkDataSources;
}

hono.get("/data-sources", async (c) => {
	return c.json(await getNetworkDataSources());
});

hono.get("/networks/:id/data-sources", createParamValidator(getNetworkDataSourcesParamSchema), async (c) => {
	const { id } = c.req.valid("param");

	const networkDataSources = await getNetworkDataSources();
	const entry = networkDataSources.find(({ network }) => network.id === id);
	return c.json(entry?.sources ?? []);
});

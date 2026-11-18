import { sql } from "drizzle-orm";

import { database } from "../../core/database/database.js";
import { type NetworkEntity, networksTable } from "../../core/database/schema.js";
import { mapRowsToEntity } from "../../core/database/utils.js";
import { useCache } from "../../utils/use-cache.js";
import { REFERENCE_CACHE_TTL_MS } from "./reference-cache.js";

/** Réseau par référence : il est relu à chaque lot, alors qu'il ne change qu'au gré d'un éditeur. */
const networkCache = useCache<NetworkEntity>(REFERENCE_CACHE_TTL_MS);

export function importNetwork(ref: string) {
	return networkCache.getOrLoad(ref, async () => {
		const rows = await database.execute(sql`SELECT * FROM public.import_network(ROW(${ref}, ${ref})::network_input)`);
		const [network] = mapRowsToEntity(networksTable, rows);
		return network!;
	});
}

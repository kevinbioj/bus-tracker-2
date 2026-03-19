import { sql } from "drizzle-orm";
import { Temporal } from "temporal-polyfill";

import { database } from "../../core/database/database.js";
import { type NetworkEntity, networksTable } from "../../core/database/schema.js";
import { mapRowsToEntity } from "../../core/database/utils.js";
import { useCache } from "../../utils/use-cache.js";

const cache = useCache<NetworkEntity>(Temporal.Duration.from({ minutes: 60 }).total("milliseconds"));

export async function importNetwork(ref: string) {
	const cached = cache.get(ref);

	if (cached) {
		return cached;
	}

	const rows = await database.execute(sql`SELECT * FROM public.import_network(ROW(${ref}, ${ref})::network_input)`);

	const [network] = mapRowsToEntity(networksTable, rows);

	if (network) {
		cache.set(ref, network);
	}

	return network!;
}

import { sql } from "drizzle-orm";

import { database } from "../../core/database/database.js";
import { type NetworkEntity, networksTable } from "../../core/database/schema.js";
import { mapRowsToEntity } from "../../core/database/utils.js";

import { redis } from "../vehicle-worker.js";

const CACHE_TTL = 300;

export async function importNetwork(ref: string) {
	const cached = await redis.get(ref);

	if (cached) {
		return JSON.parse(cached) as NetworkEntity;
	}

	const rows = await database.execute(sql`SELECT * FROM public.import_network(${ref})`);

	const [network] = mapRowsToEntity(networksTable, rows);

	if (network) {
		await redis.set(ref, JSON.stringify(network), { EX: CACHE_TTL });
	}

	return network!;
}

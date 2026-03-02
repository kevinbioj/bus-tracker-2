import { sql } from "drizzle-orm";

import { database } from "../../core/database/database.js";
import { networksTable } from "../../core/database/schema.js";
import { mapRowsToEntity } from "../../core/database/utils.js";

export async function importNetwork(ref: string) {
	const rows = await database.execute(sql`SELECT * FROM public.import_network(${ref})`);

	const [network] = mapRowsToEntity(networksTable, rows);
	return network!;
}

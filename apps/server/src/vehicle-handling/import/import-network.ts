import { getTableColumns, sql } from "drizzle-orm";

import { database } from "../../core/database/database.js";
import { type NetworkEntity, networksTable } from "../../core/database/schema.js";

export async function importNetwork(ref: string) {
	const columns = getTableColumns(networksTable);
	const rows = await database.execute(sql`SELECT * FROM public.import_network(${ref})`);

	const [network] = rows.map((row) => {
		const mapped: Record<string, unknown> = {};

		for (const [key, col] of Object.entries(columns)) {
			mapped[key] = col.mapFromDriverValue(row[col.name]);
		}

		return mapped;
	}) as NetworkEntity[];

	return network!;
}

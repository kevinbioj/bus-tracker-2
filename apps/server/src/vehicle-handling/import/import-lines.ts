import type { VehicleJourneyLine } from "@bus-tracker/contracts";
import { getTableColumns, sql } from "drizzle-orm";
import type { Temporal } from "temporal-polyfill";

import { database } from "../../core/database/database.js";
import { type LineEntity, linesTable, type NetworkEntity } from "../../core/database/schema.js";

export async function importLines(
	network: NetworkEntity,
	linesData: VehicleJourneyLine[],
	recordedAt: Temporal.Instant,
) {
	if (linesData.length === 0) return [];

	const columns = getTableColumns(linesTable);
	const rows = await database.execute(
		sql`SELECT * FROM public.import_lines(
			${network.id}, 
			${JSON.stringify(linesData)}::jsonb, 
			${recordedAt.toString()}::timestamp
		)`,
	);

	return rows.map((row) => {
		const mapped: Record<string, unknown> = {};

		for (const [key, col] of Object.entries(columns)) {
			mapped[key] = col.mapFromDriverValue(row[col.name]);
		}

		return mapped;
	}) as LineEntity[];
}

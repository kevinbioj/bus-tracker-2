import type { VehicleJourneyLine } from "@bus-tracker/contracts";
import { sql } from "drizzle-orm";
import type { Temporal } from "temporal-polyfill";

import { database } from "../../core/database/database.js";
import { linesTable, type NetworkEntity } from "../../core/database/schema.js";
import { mapRowsToEntity } from "../../core/database/utils.js";

export async function importLines(
	network: NetworkEntity,
	linesData: VehicleJourneyLine[],
	recordedAt: Temporal.Instant,
) {
	if (linesData.length === 0) return [];

	const sqlRows = sql.join(
		linesData.map((l) => sql`ROW(${l.ref}, ${l.number}, ${l.color ?? null}, ${l.textColor ?? null})::line_input`),
		sql`,`,
	);

	const rows = await database.execute(
		sql`SELECT * FROM public.import_lines(
				${network.id}, 
				ARRAY[${sqlRows}], 
				${recordedAt.toString()}
			)`,
	);

	return mapRowsToEntity(linesTable, rows);
}

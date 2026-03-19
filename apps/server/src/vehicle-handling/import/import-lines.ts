import type { VehicleJourneyLine } from "@bus-tracker/contracts";
import { sql } from "drizzle-orm";
import { Temporal } from "temporal-polyfill";

import { database } from "../../core/database/database.js";
import { type LineEntity, linesTable, type NetworkEntity } from "../../core/database/schema.js";
import { mapRowsToEntity } from "../../core/database/utils.js";
import { useCache } from "../../utils/use-cache.js";

const cache = useCache<LineEntity>(Temporal.Duration.from({ minutes: 1 }).total("milliseconds"));

export async function importLines(
	network: NetworkEntity,
	linesData: VehicleJourneyLine[],
	recordedAt: Temporal.Instant,
) {
	if (linesData.length === 0) return [];

	const resultLines: LineEntity[] = [];
	const missingLinesData: VehicleJourneyLine[] = [];

	const cachedResults = linesData.map((line) => cache.get(line.ref));

	for (let i = 0; i < linesData.length; i++) {
		const cached = cachedResults[i];
		if (cached) {
			resultLines.push(cached);
		} else {
			missingLinesData.push(linesData[i]!);
		}
	}

	if (missingLinesData.length > 0) {
		const sqlRows = sql.join(
			missingLinesData.map(
				(l) => sql`ROW(${l.ref}, ${l.number}, ${l.color ?? null}, ${l.textColor ?? null})::line_input`,
			),
			sql`,`,
		);

		const rows = await database.execute(
			sql`SELECT * FROM public.import_lines(
				${network.id}, 
				ARRAY[${sqlRows}], 
				${recordedAt.toString()}
			)`,
		);

		const importedLines = mapRowsToEntity(linesTable, rows);
		for (const line of importedLines) {
			resultLines.push(line);
			for (const ref of line.references!) {
				cache.set(ref, line);
			}
		}
	}

	return resultLines;
}

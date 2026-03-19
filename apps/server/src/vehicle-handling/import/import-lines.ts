import type { VehicleJourneyLine } from "@bus-tracker/contracts";
import { sql } from "drizzle-orm";
import { Temporal } from "temporal-polyfill";

import { database } from "../../core/database/database.js";
import { type LineEntity, linesTable, type NetworkEntity } from "../../core/database/schema.js";
import { mapRowsToEntity } from "../../core/database/utils.js";

import { redis } from "../vehicle-worker.js";

const CACHE_TTL = 300;

export async function importLines(
	network: NetworkEntity,
	linesData: VehicleJourneyLine[],
	recordedAt: Temporal.Instant,
) {
	if (linesData.length === 0) return [];

	const resultLines: LineEntity[] = [];
	const missingLinesData: VehicleJourneyLine[] = [];

	const cacheKeys = linesData.map((line) => line.ref);
	const cachedResults = await redis.mGet(cacheKeys);

	for (let i = 0; i < linesData.length; i++) {
		const cached = cachedResults[i];
		if (cached) {
			const line = JSON.parse(cached) as LineEntity;
			if (line.archivedAt) {
				line.archivedAt = Temporal.Instant.from(line.archivedAt);
			}
			resultLines.push(line);
		} else {
			missingLinesData.push(linesData[i]!);
		}
	}

	if (missingLinesData.length > 0) {
		console.log(`Missing lines from cache: ${missingLinesData}`);

		const rows = await database.execute(
			sql`SELECT * FROM public.import_lines(
				${network.id}, 
				${JSON.stringify(missingLinesData)}::jsonb, 
				${recordedAt.toString()}::timestamp
			)`,
		);

		const importedLines = mapRowsToEntity(linesTable, rows);
		for (const line of importedLines) {
			resultLines.push(line);
			for (const ref of line.references!) {
				await redis.set(ref, JSON.stringify(line), { EX: CACHE_TTL });
			}
		}
	}

	return resultLines;
}

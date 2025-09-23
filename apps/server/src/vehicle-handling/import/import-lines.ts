import type { VehicleJourneyLine } from "@bus-tracker/contracts";
import { and, arrayOverlaps, eq, gte, isNull, or } from "drizzle-orm";
import type { Temporal } from "temporal-polyfill";

import { database } from "../../core/database/database.js";
import { type NetworkEntity, linesTable } from "../../core/database/schema.js";

export async function importLines(
	network: NetworkEntity,
	linesData: VehicleJourneyLine[],
	recordedAt: Temporal.Instant,
) {
	if (linesData.length === 0) return [];

	const existingLines = await database
		.select()
		.from(linesTable)
		.where(
			and(
				eq(linesTable.networkId, network.id),
				arrayOverlaps(
					linesTable.references,
					linesData.map(({ ref }) => ref),
				),
				or(isNull(linesTable.archivedAt), gte(linesTable.archivedAt, recordedAt)),
			),
		);

	const missingLines = linesData.filter(
		({ ref }) => !existingLines.some(({ references }) => references?.includes(ref)),
	);

	if (missingLines.length > 0) {
		const addedLines = await database
			.insert(linesTable)
			.values(
				missingLines.map((line) => ({
					networkId: network.id,
					references: [line.ref],
					number: line.number,
					color: line.color?.length === 6 ? line.color : undefined,
					textColor: line.textColor?.length === 6 ? line.textColor : undefined,
				})),
			)
			.returning();
		existingLines.push(...addedLines);
	}

	return existingLines;
}

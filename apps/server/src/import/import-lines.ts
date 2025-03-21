import type { VehicleJourneyLine } from "@bus-tracker/contracts";
import { and, arrayOverlaps, eq, gte, isNull, or } from "drizzle-orm";
import type { Temporal } from "temporal-polyfill";

import { database } from "../database/database.js";
import { type Network, lines } from "../database/schema.js";

export async function importLines(network: Network, linesData: VehicleJourneyLine[], recordedAt: Temporal.Instant) {
	const existingLines = await database
		.select()
		.from(lines)
		.where(
			and(
				eq(lines.networkId, network.id),
				arrayOverlaps(
					lines.references,
					linesData.map(({ ref }) => ref),
				),
				or(isNull(lines.archivedAt), gte(lines.archivedAt, recordedAt)),
			),
		);

	const missingLines = linesData.filter(
		({ ref }) => !existingLines.some(({ references }) => references?.includes(ref)),
	);

	if (missingLines.length > 0) {
		const addedLines = await database
			.insert(lines)
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

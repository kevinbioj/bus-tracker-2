import { and, eq, gte, lt, sql } from "drizzle-orm";

import { database } from "../database/database.js";
import { lineDestinationsTable } from "../database/schema.js";
import { journeyStore } from "../store/journey-store.js";

const lineDestinationRetentionCutoff = sql`NOW() - INTERVAL '7 days'`;
const lineDestinationCleanupIntervalMs = 60 * 60 * 1_000;

export async function findRecentLineDestinations(lineId: number) {
	const rows = await database
		.select({ destination: lineDestinationsTable.destination })
		.from(lineDestinationsTable)
		.where(
			and(
				eq(lineDestinationsTable.lineId, lineId),
				gte(lineDestinationsTable.lastSeenAt, lineDestinationRetentionCutoff),
			),
		);

	const destinations = new Set(rows.map(({ destination }) => destination));
	for (const journey of journeyStore.values()) {
		if (journey.lineId !== lineId) continue;
		const destination = journey.destination?.trim();
		if (destination) destinations.add(destination);
	}

	return Array.from(destinations).toSorted((a, b) => a.localeCompare(b));
}

export async function sweepExpiredLineDestinations() {
	const deletedDestinations = await database
		.delete(lineDestinationsTable)
		.where(lt(lineDestinationsTable.lastSeenAt, lineDestinationRetentionCutoff))
		.returning({ lineId: lineDestinationsTable.lineId });

	console.log("► Swept %d expired line destinations.", deletedDestinations.length);
}

export function startLineDestinationCleanupService() {
	const interval = setInterval(() => {
		sweepExpiredLineDestinations().catch((error) => {
			console.error("✘ Failed to sweep expired line destinations:", error instanceof Error ? error.stack : error);
		});
	}, lineDestinationCleanupIntervalMs);

	interval.unref();
}

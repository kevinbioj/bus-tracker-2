import { sql } from "drizzle-orm";

import { database } from "../core/database/database.js";
import { lineDestinationsTable } from "../core/database/schema.js";
import type { DisposeableVehicleJourney } from "../types/disposeable-vehicle-journey.js";

const DESTINATION_WRITE_INTERVAL_MS = 60 * 60_000;

const lastWrites = new Map<string, number>();
let lastSweepAtMs = Date.now();

function sweepLastWrites(nowMs: number) {
	if (nowMs - lastSweepAtMs < DESTINATION_WRITE_INTERVAL_MS) return;
	lastSweepAtMs = nowMs;
	for (const [key, writtenAtMs] of lastWrites) {
		if (nowMs - writtenAtMs >= DESTINATION_WRITE_INTERVAL_MS) lastWrites.delete(key);
	}
}

export async function registerDestinations(vehicleJourneys: DisposeableVehicleJourney[], now: Temporal.Instant) {
	const nowMs = now.epochMilliseconds;
	sweepLastWrites(nowMs);

	const destinations = new Map<string, { lineId: number; destination: string }>();

	for (const vehicleJourney of vehicleJourneys) {
		const destination = vehicleJourney.destination?.trim();
		if (vehicleJourney.lineId === undefined || !destination) continue;

		const key = `${vehicleJourney.lineId}:${destination}`;
		const lastWriteMs = lastWrites.get(key);
		if (lastWriteMs !== undefined && nowMs - lastWriteMs < DESTINATION_WRITE_INTERVAL_MS) continue;

		destinations.set(key, { lineId: vehicleJourney.lineId, destination });
	}

	if (destinations.size === 0) return;

	try {
		await database
			.insert(lineDestinationsTable)
			.values(Array.from(destinations.values(), (entry) => ({ ...entry, lastSeenAt: now })))
			.onConflictDoUpdate({
				target: [lineDestinationsTable.lineId, lineDestinationsTable.destination],
				set: { lastSeenAt: sql`excluded.last_seen_at` },
			});
	} catch (error) {
		console.error("✘ [Worker] Failed to register line destinations:", error);
		return;
	}

	for (const key of destinations.keys()) lastWrites.set(key, nowMs);
}

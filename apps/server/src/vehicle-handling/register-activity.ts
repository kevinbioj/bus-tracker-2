import { and, eq, gte } from "drizzle-orm";
import { Temporal } from "temporal-polyfill";

import { database } from "../core/database/database.js";
import { lineActivitiesTable, vehiclesTable } from "../core/database/schema.js";
import type { DisposeableVehicleJourney } from "../types/disposeable-vehicle-journey.js";

const ACTIVITY_THRESHOLD_MNS = 90;

export async function registerActivity(vehicleJourney: DisposeableVehicleJourney) {
	if (typeof vehicleJourney.lineId === "undefined" || typeof vehicleJourney.vehicle?.id === "undefined") return;

	const recordedAt = Temporal.Instant.from(vehicleJourney.position.recordedAt);

	const [currentActivity] = await database
		.select()
		.from(lineActivitiesTable)
		.where(
			and(
				eq(lineActivitiesTable.vehicleId, vehicleJourney.vehicle.id),
				eq(lineActivitiesTable.lineId, vehicleJourney.lineId),
				gte(lineActivitiesTable.updatedAt, recordedAt.subtract({ minutes: ACTIVITY_THRESHOLD_MNS })),
			),
		);

	await Promise.all([
		database
			.update(vehiclesTable)
			.set({ lastSeenAt: recordedAt })
			.where(eq(vehiclesTable.id, vehicleJourney.vehicle.id)),
		typeof currentActivity !== "undefined"
			? database
					.update(lineActivitiesTable)
					.set({ updatedAt: recordedAt })
					.where(eq(lineActivitiesTable.id, currentActivity.id))
			: database.insert(lineActivitiesTable).values({
					vehicleId: vehicleJourney.vehicle.id,
					lineId: vehicleJourney.lineId,
					serviceDate: (vehicleJourney.serviceDate
						? Temporal.PlainDate.from(vehicleJourney.serviceDate)
						: Temporal.Now.plainDateISO()
					).toString(),
					startedAt: recordedAt,
					updatedAt: recordedAt,
				}),
	]);
}

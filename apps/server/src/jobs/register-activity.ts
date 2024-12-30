import { and, eq, gte } from "drizzle-orm";
import { Temporal } from "temporal-polyfill";

import { database } from "../database/database.js";
import { lineActivities, vehicles } from "../database/schema.js";
import type { DisposeableVehicleJourney } from "../types/disposeable-vehicle-journey.js";

const ACTIVITY_THRESHOLD_MNS = 90;

export async function registerActivity(vehicleJourney: DisposeableVehicleJourney) {
	if (typeof vehicleJourney.lineId === "undefined" || typeof vehicleJourney.vehicle?.id === "undefined") return;

	const recordedAt = Temporal.Instant.from(vehicleJourney.position.recordedAt);

	const [currentActivity] = await database
		.select()
		.from(lineActivities)
		.where(
			and(
				eq(lineActivities.vehicleId, vehicleJourney.vehicle.id),
				eq(lineActivities.lineId, vehicleJourney.lineId),
				gte(lineActivities.updatedAt, recordedAt.subtract({ minutes: ACTIVITY_THRESHOLD_MNS })),
			),
		);

	await Promise.all([
		database.update(vehicles).set({ lastSeenAt: recordedAt }).where(eq(vehicles.id, vehicleJourney.vehicle.id)),
		typeof currentActivity !== "undefined"
			? database.update(lineActivities).set({ updatedAt: recordedAt }).where(eq(lineActivities.id, currentActivity.id))
			: database.insert(lineActivities).values({
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

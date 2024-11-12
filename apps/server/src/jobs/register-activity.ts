import type { VehicleJourney } from "@bus-tracker/contracts";
import { and, eq, gte } from "drizzle-orm";
import { Temporal } from "temporal-polyfill";

import { database } from "../database/database.js";
import { type Line, type Network, lineActivities, vehicles } from "../database/schema.js";
import { importVehicle } from "../import/import-vehicle.js";

const ACTIVITY_THRESHOLD_MNS = 10;

export async function registerActivity(vehicleJourney: VehicleJourney, network: Network, line?: Line) {
	if (
		typeof line === "undefined" ||
		typeof vehicleJourney.vehicleRef === "undefined" ||
		vehicleJourney.line?.type === "RAIL"
	)
		return;

	const vehicle = await importVehicle(network, vehicleJourney.vehicleRef);

	const recordedAt = Temporal.Instant.from(vehicleJourney.position.recordedAt);

	const [currentActivity] = await database
		.select()
		.from(lineActivities)
		.where(
			and(
				eq(lineActivities.vehicleId, vehicle.id),
				eq(lineActivities.lineId, line.id),
				gte(lineActivities.updatedAt, recordedAt.subtract({ minutes: ACTIVITY_THRESHOLD_MNS })),
			),
		);

	await Promise.all([
		database.update(vehicles).set({ lastSeenAt: recordedAt }).where(eq(vehicles.id, vehicle.id)),
		typeof currentActivity !== "undefined"
			? database.update(lineActivities).set({ updatedAt: recordedAt }).where(eq(lineActivities.id, currentActivity.id))
			: database.insert(lineActivities).values({
					vehicleId: vehicle.id,
					lineId: line.id,
					serviceDate: Temporal.PlainDate.from(vehicleJourney.serviceDate!).toString(),
					startedAt: recordedAt,
					updatedAt: recordedAt,
				}),
	]);
}

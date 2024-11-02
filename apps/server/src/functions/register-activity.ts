import * as Sentry from "@sentry/node";
import { and, eq, gte } from "drizzle-orm";
import pLimit from "p-limit";
import { Temporal } from "temporal-polyfill";

import type { VehicleJourney } from "@bus-tracker/contracts";

import { database } from "../database/database.js";
import { lineActivities, vehicles } from "../database/schema.js";
import { importLine } from "../import/import-line.js";
import { importVehicle } from "../import/import-vehicle.js";

const ACTIVITY_THRESHOLD_MNS = 10;

const registerFn = pLimit(1);

export function registerActivity(vehicleJourney: VehicleJourney) {
	return registerFn(async () => {
		try {
			await _registerActivity(vehicleJourney);
		} catch (error) {
			console.error("Failed to register activity for '%s':", vehicleJourney.id, error);
			Sentry.captureException(error, {
				extra: { journey: vehicleJourney },
				tags: { section: "activity-registration" },
			});
		}
	});
}

async function _registerActivity(vehicleJourney: VehicleJourney) {
	if (typeof vehicleJourney.line === "undefined" || typeof vehicleJourney.vehicleRef === "undefined") return;

	const vehicle = await importVehicle(vehicleJourney.networkRef, vehicleJourney.vehicleRef, vehicleJourney.operatorRef);
	const line = await importLine(
		vehicleJourney.networkRef,
		vehicleJourney.line,
		Temporal.Instant.from(vehicleJourney.updatedAt),
	);

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

import { DrizzleQueryError, type SQL, sql } from "drizzle-orm";
import pg from "postgres";
import { Temporal } from "temporal-polyfill";

import { database } from "../core/database/database.js";
import type { DisposeableVehicleJourney } from "../types/disposeable-vehicle-journey.js";

const ACTIVITY_THRESHOLD_MNS = 90;

type RegisterActivityInput = {
	vehicleId: number;
	lineId: number;
	serviceDate: Temporal.PlainDate;
	recordedAt: Temporal.Instant;
};

const performRegistration = async (sqlRows: SQL<unknown>, retryCount = 3) => {
	try {
		await database.execute(sql`
			SELECT register_activities(
				ARRAY[${sqlRows}],
				${ACTIVITY_THRESHOLD_MNS}
			)
		`);
	} catch (error) {
		if (error instanceof DrizzleQueryError && error.cause instanceof pg.PostgresError && error.cause.code === "40P01") {
			if (retryCount === 0) {
				return;
			}

			await performRegistration(sqlRows, retryCount - 1);
			return;
		}

		console.error(error);
	}
};

export async function registerActivities(vehicleJourneys: DisposeableVehicleJourney[]) {
	const activities: RegisterActivityInput[] = [];

	for (const vehicleJourney of vehicleJourneys) {
		if (vehicleJourney.lineId === undefined || vehicleJourney.vehicle?.id === undefined) {
			continue;
		}

		activities.push({
			vehicleId: vehicleJourney.vehicle.id,
			lineId: vehicleJourney.lineId,
			serviceDate: vehicleJourney.serviceDate
				? Temporal.PlainDate.from(vehicleJourney.serviceDate)
				: Temporal.Now.plainDateISO(),
			recordedAt: Temporal.Instant.from(vehicleJourney.position.recordedAt),
		});
	}

	if (activities.length === 0) {
		return;
	}

	const sqlRows = sql.join(
		activities
			.toSorted((a, b) => a.vehicleId - b.vehicleId)
			.map(
				(a) =>
					sql`ROW(${a.vehicleId}, ${a.lineId}, ${a.recordedAt.toString()}, ${a.serviceDate.toString()})::activity_input`,
			),
		sql`,`,
	);

	await performRegistration(sqlRows);
}

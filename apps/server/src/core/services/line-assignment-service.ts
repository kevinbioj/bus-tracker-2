import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";

import { database } from "../database/database.js";
import { lineActivitiesTable, vehiclesTable } from "../database/schema.js";

const ONGOING_ACTIVITY_GRACE_MINUTES = 10;

export type LineVehicleAssignments = {
	activeDays: string[];
	vehicles: {
		id: number;
		number: string;
		designation: string | null;
		activities: { startedAt: Temporal.Instant; endedAt: Temporal.Instant | null }[];
	}[];
};

export async function findLineVehicleAssignments(lineId: number, date: Temporal.PlainDate) {
	const lineActivities = await database
		.select({
			vehicleId: lineActivitiesTable.vehicleId,
			startedAt: lineActivitiesTable.startedAt,
			endedAt: lineActivitiesTable.updatedAt,
		})
		.from(lineActivitiesTable)
		.where(and(eq(lineActivitiesTable.lineId, lineId), eq(lineActivitiesTable.serviceDate, date.toString())))
		.orderBy(asc(lineActivitiesTable.startedAt));

	const lineActivitiesByVehicleId = Map.groupBy(lineActivities, (lineActivity) => lineActivity.vehicleId);

	let vehicles: LineVehicleAssignments["vehicles"] = [];

	if (lineActivitiesByVehicleId.size > 0) {
		const vehicleData = await database
			.select({ id: vehiclesTable.id, number: vehiclesTable.number, designation: vehiclesTable.designation })
			.from(vehiclesTable)
			.where(inArray(vehiclesTable.id, Array.from(lineActivitiesByVehicleId.keys())));

		const now = Temporal.Now.instant();
		vehicles = vehicleData.map((vehicle) => ({
			...vehicle,
			activities: (lineActivitiesByVehicleId.get(vehicle.id) ?? []).map((lineActivity) => ({
				startedAt: lineActivity.startedAt,
				endedAt:
					now.since(lineActivity.endedAt).total("minutes") >= ONGOING_ACTIVITY_GRACE_MINUTES
						? lineActivity.endedAt
						: null,
			})),
		}));
	}

	// Bornes du mois plutôt qu'un EXTRACT : l'index (line_id, service_date) peut alors servir.
	const monthStart = date.with({ day: 1 });
	const activeDays = await database
		.select({ serviceDate: lineActivitiesTable.serviceDate })
		.from(lineActivitiesTable)
		.where(
			and(
				eq(lineActivitiesTable.lineId, lineId),
				gte(lineActivitiesTable.serviceDate, monthStart.toString()),
				lt(lineActivitiesTable.serviceDate, monthStart.add({ months: 1 }).toString()),
			),
		)
		.groupBy(lineActivitiesTable.serviceDate);

	return { activeDays: activeDays.map((day) => day.serviceDate), vehicles } satisfies LineVehicleAssignments;
}

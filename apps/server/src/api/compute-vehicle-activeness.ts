import { and, desc, eq } from "drizzle-orm";
import { Temporal } from "temporal-polyfill";

import { database } from "../core/database/database.js";
import { lineActivitiesTable, type VehicleEntity } from "../core/database/schema.js";
import { journeyStore } from "../core/store/journey-store.js";

export type VehicleActiveness =
	| { mode: "NO_DATA" }
	| { mode: "NON_COMMERCIAL" }
	| { mode: "INACTIVE"; since: Temporal.Instant }
	| { mode: "ACTIVE"; since: Temporal.Instant; line: { id: number } };

export async function computeVehicleActiveness(vehicle: VehicleEntity): Promise<VehicleActiveness> {
	if (vehicle.lastSeenAt === null) {
		return { mode: "NO_DATA" };
	}

	if (Temporal.Now.instant().since(vehicle.lastSeenAt).total("minutes") >= 10) {
		return { mode: "INACTIVE", since: vehicle.lastSeenAt };
	}

	const journey =
		journeyStore.get(vehicle.ref.replace("Vehicle", "VehicleTracking")) ??
		journeyStore.values().find((journey) => journey.vehicle?.id === vehicle.id);

	if (typeof journey === "undefined") return { mode: "INACTIVE", since: vehicle.lastSeenAt };
	if (typeof journey.lineId === "undefined") return { mode: "NON_COMMERCIAL" };

	const [latestActivity] = await database
		.select()
		.from(lineActivitiesTable)
		.where(and(eq(lineActivitiesTable.vehicleId, vehicle.id), eq(lineActivitiesTable.lineId, journey.lineId)))
		.orderBy(desc(lineActivitiesTable.startedAt))
		.limit(1);

	if (typeof latestActivity === "undefined") return { mode: "NON_COMMERCIAL" };

	return {
		mode: "ACTIVE",
		line: { id: latestActivity.lineId },
		since: latestActivity.startedAt,
	};
}

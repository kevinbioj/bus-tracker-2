import { lt, sql } from "drizzle-orm";

import { database } from "../database/database.js";
import { vehicleReportsTable } from "../database/schema.js";

const vehicleReportRetentionCutoff = sql`NOW() - INTERVAL '7 days'`;
const vehicleReportCleanupIntervalMs = 60 * 60 * 1_000;

export async function sweepExpiredVehicleReports() {
	const deletedReports = await database
		.delete(vehicleReportsTable)
		.where(lt(vehicleReportsTable.createdAt, vehicleReportRetentionCutoff))
		.returning({ id: vehicleReportsTable.id });

	console.log("► Swept %d expired vehicle reports.", deletedReports.length);
}

export function startVehicleReportCleanupService() {
	const interval = setInterval(() => {
		sweepExpiredVehicleReports().catch((error) => {
			console.error("✘ Failed to sweep expired vehicle reports:", error instanceof Error ? error.stack : error);
		});
	}, vehicleReportCleanupIntervalMs);

	interval.unref();
}

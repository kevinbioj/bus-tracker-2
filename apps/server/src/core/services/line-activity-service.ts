import { sql } from "drizzle-orm";

import { database } from "../database/database.js";
import { lineActivitiesTable } from "../database/schema.js";

/**
 * Début de l'activité en cours de chaque véhicule sur sa ligne : la dernière démarrée du couple, ses
 * activités se succédant sans se chevaucher. Une recherche par couple, servie par l'index
 * (vehicle_id, line_id, started_at).
 */
export async function findActivityStarts(pairs: { vehicleId: number; lineId: number }[]) {
	const starts = new Map<number, Temporal.Instant>();
	if (pairs.length === 0) return starts;

	const input = JSON.stringify(pairs.map(({ vehicleId, lineId }) => ({ vehicle_id: vehicleId, line_id: lineId })));
	const rows = await database.execute<{ vehicle_id: number; started_at: string }>(sql`
		SELECT p.vehicle_id, la.started_at
		FROM jsonb_to_recordset(${input}::jsonb) AS p(vehicle_id integer, line_id integer)
		CROSS JOIN LATERAL (
			SELECT started_at
			FROM line_activity
			WHERE vehicle_id = p.vehicle_id AND line_id = p.line_id
			ORDER BY started_at DESC
			LIMIT 1
		) la
	`);

	for (const row of rows) {
		// Même conversion que les lectures typées de la colonne.
		starts.set(row.vehicle_id, lineActivitiesTable.startedAt.mapFromDriverValue(row.started_at) as Temporal.Instant);
	}
	return starts;
}

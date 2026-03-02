import { getTableColumns, sql } from "drizzle-orm";

import { database } from "../../core/database/database.js";
import { type NetworkEntity, type VehicleEntity, vehiclesTable } from "../../core/database/schema.js";

export async function importVehicles(network: NetworkEntity, vehicleRefs: Set<string>) {
	if (vehicleRefs.size === 0) return [];

	const columns = getTableColumns(vehiclesTable);
	const rows = await database.execute(
		sql`SELECT * FROM public.import_vehicles(
			${network.id}, 
			ARRAY[${sql.join(Array.from(vehicleRefs), sql`, `)}]::text[]
		)`,
	);

	return rows.map((row) => {
		const mapped: Record<string, unknown> = {};

		for (const [key, col] of Object.entries(columns)) {
			mapped[key] = col.mapFromDriverValue(row[col.name]);
		}

		return mapped;
	}) as VehicleEntity[];
}

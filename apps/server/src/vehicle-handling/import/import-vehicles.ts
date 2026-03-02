import { sql } from "drizzle-orm";

import { database } from "../../core/database/database.js";
import { type NetworkEntity, vehiclesTable } from "../../core/database/schema.js";
import { mapRowsToEntity } from "../../core/database/utils.js";

export async function importVehicles(network: NetworkEntity, vehicleRefs: Set<string>) {
	if (vehicleRefs.size === 0) return [];

	const rows = await database.execute(
		sql`SELECT * FROM public.import_vehicles(
			${network.id}, 
			ARRAY[${sql.join(Array.from(vehicleRefs), sql`, `)}]::text[]
		)`,
	);

	return mapRowsToEntity(vehiclesTable, rows);
}

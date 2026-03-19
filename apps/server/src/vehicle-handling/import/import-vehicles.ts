import { sql } from "drizzle-orm";
import { Temporal } from "temporal-polyfill";

import { database } from "../../core/database/database.js";
import { type NetworkEntity, type VehicleEntity, vehiclesTable } from "../../core/database/schema.js";
import { mapRowsToEntity } from "../../core/database/utils.js";
import { useCache } from "../../utils/use-cache.js";

const cache = useCache<VehicleEntity>(Temporal.Duration.from({ minutes: 1 }).total("milliseconds"));

export async function importVehicles(network: NetworkEntity, vehicleRefs: Set<string>) {
	if (vehicleRefs.size === 0) return [];

	const resultVehicles: VehicleEntity[] = [];
	const missingVehicleRefs: string[] = [];

	const vehicleRefsArray = Array.from(vehicleRefs);
	const cachedResults = vehicleRefsArray.map((ref) => cache.get(ref));

	for (let i = 0; i < vehicleRefsArray.length; i++) {
		const cached = cachedResults[i];
		if (cached) {
			resultVehicles.push(cached);
		} else {
			missingVehicleRefs.push(vehicleRefsArray[i]!);
		}
	}

	if (missingVehicleRefs.length > 0) {
		const sqlRows = sql.join(
			missingVehicleRefs.map((r) => sql`ROW(${r})::vehicle_input`),
			sql`,`,
		);

		const rows = await database.execute(
			sql`SELECT * FROM public.import_vehicles(
				${network.id}, 
				ARRAY[${sqlRows}]
			)`,
		);

		const importedVehicles = mapRowsToEntity(vehiclesTable, rows);

		for (const vehicle of importedVehicles) {
			resultVehicles.push(vehicle);
			cache.set(vehicle.ref, vehicle);
		}
	}

	return resultVehicles;
}

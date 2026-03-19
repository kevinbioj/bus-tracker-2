import { sql } from "drizzle-orm";
import { Temporal } from "temporal-polyfill";

import { database } from "../../core/database/database.js";
import { type NetworkEntity, type VehicleEntity, vehiclesTable } from "../../core/database/schema.js";
import { mapRowsToEntity } from "../../core/database/utils.js";

import { redis } from "../vehicle-worker.js";

const CACHE_TTL = 300;

export async function importVehicles(network: NetworkEntity, vehicleRefs: Set<string>) {
	if (vehicleRefs.size === 0) return [];

	const resultVehicles: VehicleEntity[] = [];
	const missingVehicleRefs: string[] = [];

	const vehicleRefsArray = Array.from(vehicleRefs);
	const cacheKeys = vehicleRefsArray.map((ref) => ref);
	const cachedResults = await redis.mGet(cacheKeys);

	for (let i = 0; i < vehicleRefsArray.length; i++) {
		const cached = cachedResults[i];
		if (cached) {
			const vehicle = JSON.parse(cached) as VehicleEntity;
			if (vehicle.lastSeenAt) {
				vehicle.lastSeenAt = Temporal.Instant.from(vehicle.lastSeenAt as unknown as string);
			}
			if (vehicle.archivedAt) {
				vehicle.archivedAt = Temporal.Instant.from(vehicle.archivedAt as unknown as string);
			}
			resultVehicles.push(vehicle);
		} else {
			missingVehicleRefs.push(vehicleRefsArray[i]!);
		}
	}

	if (missingVehicleRefs.length > 0) {
		const rows = await database.execute(
			sql`SELECT * FROM public.import_vehicles(
				${network.id}, 
				ARRAY[${sql.join(missingVehicleRefs, sql`, `)}]::text[]
			)`,
		);

		const importedVehicles = mapRowsToEntity(vehiclesTable, rows);

		for (const vehicle of importedVehicles) {
			resultVehicles.push(vehicle);
			await redis.set(vehicle.ref, JSON.stringify(vehicle), { EX: CACHE_TTL });
		}
	}

	return resultVehicles;
}

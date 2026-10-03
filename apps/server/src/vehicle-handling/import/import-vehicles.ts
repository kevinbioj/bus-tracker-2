import { sql } from "drizzle-orm";

import { database } from "../../core/database/database.js";
import { type NetworkEntity, type VehicleEntity, vehiclesTable } from "../../core/database/schema.js";
import { mapRowsToEntity } from "../../core/database/utils.js";
import { useCache } from "../../utils/use-cache.js";
import { REFERENCE_CACHE_TTL_MS } from "./reference-cache.js";

/** Véhicules par réseau et par référence. */
const vehicleCache = useCache<VehicleEntity>(REFERENCE_CACHE_TTL_MS);
const cacheKey = (networkId: number, ref: string) => `${networkId}|${ref}`;

/**
 * Véhicules des références données, créés si besoin, indexés par référence. Seules les références
 * absentes du cache sont soumises à la base.
 */
export async function importVehicles(network: NetworkEntity, vehicleRefs: Set<string>) {
	const vehicles = new Map<string, VehicleEntity>();
	const unknownRefs: string[] = [];

	for (const ref of vehicleRefs) {
		const cached = vehicleCache.get(cacheKey(network.id, ref));
		if (cached !== undefined) {
			vehicles.set(ref, cached);
		} else {
			unknownRefs.push(ref);
		}
	}

	if (unknownRefs.length === 0) return vehicles;

	const rows = await database.execute(
		sql`SELECT * FROM public.import_vehicles(${network.id}::integer, ${JSON.stringify(unknownRefs)}::jsonb)`,
	);

	for (const vehicle of mapRowsToEntity(vehiclesTable, rows)) {
		vehicleCache.set(cacheKey(network.id, vehicle.ref), vehicle);
		vehicles.set(vehicle.ref, vehicle);
	}

	return vehicles;
}

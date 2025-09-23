import { and, eq, inArray } from "drizzle-orm";

import { database } from "../../core/database/database.js";
import { type NetworkEntity, vehiclesTable } from "../../core/database/schema.js";
import { nthIndexOf } from "../../utils/nth-index-of.js";

export async function importVehicles(network: NetworkEntity, vehicleRefs: Set<string>) {
	if (vehicleRefs.size === 0) return [];

	const existingVehicles = await database
		.select()
		.from(vehiclesTable)
		.where(and(eq(vehiclesTable.networkId, network.id), inArray(vehiclesTable.ref, Array.from(vehicleRefs))));

	const missingVehicles = vehicleRefs.difference(new Set(existingVehicles.map(({ ref }) => ref)));
	if (missingVehicles.size > 0) {
		const addedVehicles = await database
			.insert(vehiclesTable)
			.values(
				Array.from(missingVehicles).map((ref) => ({
					networkId: network.id,
					ref,
					number: ref.slice(nthIndexOf(ref, ":", 3) + 1),
					type: "UNKNOWN" as const,
				})),
			)
			.returning();

		existingVehicles.push(...addedVehicles);
	}

	return existingVehicles;
}

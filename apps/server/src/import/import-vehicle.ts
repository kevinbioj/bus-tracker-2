import { and, eq, inArray, isNull } from "drizzle-orm";

import { database } from "../database/database.js";
import { type Network, vehicles } from "../database/schema.js";
import { nthIndexOf } from "../utils/nth-index-of.js";

export async function importVehicles(network: Network, vehicleRefs: Set<string>) {
	const existingVehicles = await database
		.select()
		.from(vehicles)
		.where(
			and(
				eq(vehicles.networkId, network.id),
				inArray(vehicles.ref, Array.from(vehicleRefs)),
				isNull(vehicles.archivedAt),
			),
		);

	const missingVehicles = vehicleRefs.difference(new Set(existingVehicles.map(({ ref }) => ref)));
	if (missingVehicles.size > 0) {
		const addedVehicles = await database
			.insert(vehicles)
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

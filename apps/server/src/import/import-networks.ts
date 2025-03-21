import { inArray } from "drizzle-orm";

import { database } from "../database/database.js";
import { networks } from "../database/schema.js";

export async function importNetworks(references: Set<string>) {
	const existingNetworks = await database
		.select()
		.from(networks)
		.where(inArray(networks.ref, Array.from(references)));

	const missingNetworks = references.difference(new Set(existingNetworks.map(({ ref }) => ref)));
	if (missingNetworks.size > 0) {
		const addedNetworks = await database
			.insert(networks)
			.values(Array.from(missingNetworks).map((ref) => ({ ref, name: ref })))
			.returning();
		existingNetworks.push(...addedNetworks);
	}

	return existingNetworks;
}

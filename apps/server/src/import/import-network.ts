import { eq } from "drizzle-orm";

import { database } from "../database/database.js";
import { networks } from "../database/schema.js";

export async function importNetwork(ref: string) {
	let [network] = await database.select().from(networks).where(eq(networks.ref, ref));
	if (typeof network === "undefined") {
		network = (
			await database
				.insert(networks)
				.values({
					ref,
					name: ref,
				})
				.returning()
		).at(0)!;
	}
	return network;
}

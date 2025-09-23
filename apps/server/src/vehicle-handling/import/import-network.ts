import { eq } from "drizzle-orm";

import { database } from "../../core/database/database.js";
import { networksTable } from "../../core/database/schema.js";

export async function importNetwork(ref: string) {
	let [network] = await database.select().from(networksTable).where(eq(networksTable.ref, ref));

	if (typeof network === "undefined") {
		network = (await database.insert(networksTable).values({ ref, name: ref }).returning())[0]!;
	}

	return network;
}

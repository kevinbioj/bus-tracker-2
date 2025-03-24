import { and, eq } from "drizzle-orm";

import { database } from "../database/database.js";
import { operators } from "../database/schema.js";

import { importNetwork } from "./import-network.js";

export async function importOperator(networkRef: string, ref: string) {
	const network = await importNetwork(networkRef);
	let [operator] = await database
		.select()
		.from(operators)
		.where(and(eq(operators.networkId, network.id), eq(operators.ref, ref)));
	if (typeof operator === "undefined") {
		operator = (
			await database
				.insert(operators)
				.values({
					ref,
					networkId: network.id,
					name: ref,
				})
				.returning()
		).at(0)!;
	}
	return operator;
}

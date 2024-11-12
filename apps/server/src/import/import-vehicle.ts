import { and, eq, isNull } from "drizzle-orm";

import { database } from "../database/database.js";
import { type Network, vehicles } from "../database/schema.js";
import { nthIndexOf } from "../utils/nth-index-of.js";

export async function importVehicle(network: Network, vehicleRef: string) {
	// const operator = operatorRef ? await importOperator(networkRef, operatorRef) : undefined;

	let [vehicle] = await database
		.select()
		.from(vehicles)
		.where(
			// operator
			// 	? and(
			// 			eq(vehicles.networkId, network.id),
			// 			eq(vehicles.operatorId, operator.id),
			// 			eq(vehicles.ref, vehicleRef),
			// 			isNull(vehicles.archivedAt),
			// 		)
			// 	:
			and(eq(vehicles.networkId, network.id), eq(vehicles.ref, vehicleRef), isNull(vehicles.archivedAt)),
		);
	if (typeof vehicle === "undefined") {
		vehicle = (
			await database
				.insert(vehicles)
				.values({
					networkId: network.id,
					ref: vehicleRef,
					number: vehicleRef.slice(nthIndexOf(vehicleRef, ":", 3) + 1),
				})
				.returning()
		).at(0)!;
	}

	return vehicle;
}

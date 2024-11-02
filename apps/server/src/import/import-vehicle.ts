import { and, eq, isNull } from "drizzle-orm";

import { database } from "../database/database.js";
import { vehicles } from "../database/schema.js";

import { nthIndexOf } from "../utils/nth-index-of.js";
import { importNetwork } from "./import-network.js";
import { importOperator } from "./import-operator.js";

export async function importVehicle(networkRef: string, vehicleRef: string, operatorRef?: string) {
	const network = await importNetwork(networkRef);
	const operator = operatorRef ? await importOperator(networkRef, operatorRef) : undefined;

	let [vehicle] = await database
		.select()
		.from(vehicles)
		.where(
			operator
				? and(
						eq(vehicles.networkId, network.id),
						eq(vehicles.operatorId, operator.id),
						eq(vehicles.ref, vehicleRef),
						isNull(vehicles.archivedAt),
					)
				: and(eq(vehicles.networkId, network.id), eq(vehicles.ref, vehicleRef), isNull(vehicles.archivedAt)),
		);
	if (typeof vehicle === "undefined") {
		vehicle = (
			await database
				.insert(vehicles)
				.values({
					networkId: network.id,
					operatorId: operator?.id,
					ref: vehicleRef,
					number: vehicleRef.slice(nthIndexOf(vehicleRef, ":", 3) + 1),
				})
				.returning()
		).at(0)!;
	}

	return vehicle;
}

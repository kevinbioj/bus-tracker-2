import { and, asc, eq, gt, isNull, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { Temporal } from "temporal-polyfill";

import { database } from "../../database/database.js";
import { linesTable, networksTable, regionsTable } from "../../database/schema.js";

import { networkToNetworkDto } from "./networks.model.js";

export async function findAllNetworks() {
	const results = await database
		.select()
		.from(networksTable)
		.leftJoin(regionsTable, eq(regionsTable.id, networksTable.regionId))
		.orderBy(asc(networksTable.id));

	return results.map(({ network, region }) => networkToNetworkDto(network, region));
}

export async function findNetworkById(id: number) {
	const [result] = await database
		.select()
		.from(networksTable)
		.leftJoin(regionsTable, eq(regionsTable.id, networksTable.regionId))
		.where(eq(networksTable.id, id));

	if (typeof result === "undefined") {
		throw new HTTPException(404, { message: `No network was found with id '${id}'.` });
	}

	const { network, region } = result;

	const lines = await database
		.select()
		.from(linesTable)
		.where(
			and(
				eq(linesTable.networkId, network.id),
				or(isNull(linesTable.archivedAt), gt(linesTable.archivedAt, Temporal.Now.instant())),
			),
		)
		.orderBy(asc(linesTable.sortOrder), asc(linesTable.number), asc(linesTable.id));

	return networkToNetworkDto(network, region, lines);
}

import { and, arrayContains, eq, isNull, or, sql } from "drizzle-orm";

import { database } from "../database/database.js";
import { girouettesTable } from "../database/schema.js";

type FindGirouetteInput = {
	networkId: number;
	lineId?: number;
	directionId?: number;
	destination?: string;
};

export async function findGirouette({ networkId, lineId, directionId, destination }: FindGirouetteInput) {
	const girouetteList = await database
		.select()
		.from(girouettesTable)
		.where(
			and(
				eq(girouettesTable.enabled, true),
				eq(girouettesTable.networkId, networkId),
				typeof lineId !== "undefined" ? eq(girouettesTable.lineId, lineId) : isNull(girouettesTable.lineId),
				typeof directionId !== "undefined"
					? or(eq(girouettesTable.directionId, directionId), isNull(girouettesTable.directionId))
					: isNull(girouettesTable.directionId),
				typeof destination !== "undefined"
					? or(
							arrayContains(girouettesTable.destinations, [destination]),
							eq(sql`cardinality(${girouettesTable.destinations})`, 0),
						)
					: eq(sql`cardinality(${girouettesTable.destinations})`, 0),
			),
		);

	const girouette = girouetteList
		.toSorted((a, b) => {
			if (a.destinations?.length !== 0 && b.destinations?.length === 0) return -1;
			if (a.destinations?.length === 0 && b.destinations?.length !== 0) return 1;
			if (a.directionId !== null && b.directionId === null) return -1;
			if (a.directionId === null && b.directionId !== null) return 1;
			if (a.lineId !== null && b.lineId === null) return -1;
			if (a.lineId === null && b.lineId !== null) return 1;
			return 0;
		})
		.at(0);

	return girouette;
}

import { and, arrayContains, eq, isNull, or, sql } from "drizzle-orm";

import { database } from "../database/database.js";
import { girouettes } from "../database/schema.js";

type FindGirouetteInput = {
	networkId: number;
	lineId?: number;
	directionId?: number;
	destination?: string;
};

export async function findGirouette({ networkId, lineId, directionId, destination }: FindGirouetteInput) {
	const girouetteList = await database
		.select()
		.from(girouettes)
		.where(
			and(
				eq(girouettes.enabled, true),
				eq(girouettes.networkId, networkId),
				typeof lineId !== "undefined" ? eq(girouettes.lineId, lineId) : isNull(girouettes.lineId),
				typeof directionId !== "undefined"
					? or(eq(girouettes.directionId, directionId), isNull(girouettes.directionId))
					: isNull(girouettes.directionId),
				typeof destination !== "undefined"
					? or(
							arrayContains(girouettes.destinations, [destination]),
							eq(sql`cardinality(${girouettes.destinations})`, 0),
						)
					: eq(sql`cardinality(${girouettes.destinations})`, 0),
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

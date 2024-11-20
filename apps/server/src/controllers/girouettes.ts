import { and, arrayContains, eq, isNull, or, sql } from "drizzle-orm";
import type { Hono } from "hono";
import { z } from "zod";

import { database } from "../database/database.js";
import { girouettes } from "../database/schema.js";
import { createQueryValidator } from "../helpers/validator-helpers.js";

const getGirouettesQuery = z.object({
	networkId: z.coerce.number().min(0),
	lineId: z.coerce.number().min(0).optional(),
	directionId: z
		.enum(["OUTBOUND", "INBOUND"])
		.transform((direction) => (direction === "OUTBOUND" ? 0 : 1))
		.optional(),
	destination: z.string().optional(),
});

export const registerGirouetteRoutes = (hono: Hono) => {
	hono.get("/girouettes", createQueryValidator(getGirouettesQuery), async (c) => {
		const { networkId, lineId, directionId, destination } = c.req.valid("query");

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
						: undefined,
				),
			);

		return c.json(
			girouetteList.toSorted((a, b) => {
				if (a.destinations?.length !== 0 && b.destinations?.length === 0) return -1;
				if (a.destinations?.length === 0 && b.destinations?.length !== 0) return 1;
				if (a.directionId !== null && b.directionId === null) return -1;
				if (a.directionId === null && b.directionId !== null) return 1;
				if (a.lineId !== null && b.lineId === null) return -1;
				if (a.lineId === null && b.lineId !== null) return 1;
				return 0;
			}),
		);
	});
};

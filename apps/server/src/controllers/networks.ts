import { eq } from "drizzle-orm";
import * as z from "zod";

import { database } from "../database/database.js";
import { linesTable, networksTable, operatorsTable } from "../database/schema.js";
import { createParamValidator, createQueryValidator } from "../helpers/validator-helpers.js";
import { hono } from "../server.js";
import { journeyStore } from "../store/journey-store.js";

const getNetworkByIdParamSchema = z.object({
	id: z.coerce.number().min(0),
});

const getNetworkByIdQuerySchema = z.object({
	withDetails: z
		.enum(["true", "false"])
		.default("false")
		.transform((value) => value === "true"),
});

hono.get("/networks", async (c) => {
	const networkList = await database.select().from(networksTable);
	return c.json(networkList);
});

hono.get(
	"/networks/:id",
	createParamValidator(getNetworkByIdParamSchema),
	createQueryValidator(getNetworkByIdQuerySchema),
	async (c) => {
		const { id } = c.req.valid("param");
		const { withDetails } = c.req.valid("query");

		const [network] = await database.select().from(networksTable).where(eq(networksTable.id, id));
		if (typeof network === "undefined") return c.json({ error: `No network found with id '${id}'.` }, 404);

		if (withDetails) {
			const onlineNetworkVehicles = journeyStore
				.values()
				.filter((journey) => journey.networkId === network.id)
				.toArray();

			const operatorList = await database.select().from(operatorsTable).where(eq(operatorsTable.networkId, network.id));
			const lineList = await database.select().from(linesTable).where(eq(linesTable.networkId, network.id));
			return c.json({
				...network,
				operators: operatorList.map(({ networkId, ...operator }) => operator),
				lines: lineList
					.toSorted((a, b) => {
						const sortOrderDiff = (a.sortOrder ?? lineList.length) - (b.sortOrder ?? lineList.length);
						return sortOrderDiff || Number.parseInt(a.number, 10) - Number.parseInt(b.number, 10);
					})
					.map(({ networkId, ...line }) => ({
						...line,
						onlineVehicleCount: onlineNetworkVehicles.filter(
							(journey) => journey.lineId === line.id && typeof journey.vehicle?.id !== "undefined",
						).length,
					})),
			});
		} else {
			return c.json(network);
		}
	},
);

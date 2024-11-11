import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import * as z from "zod";

import { database } from "../database/database.js";
import { lines, networks, operators } from "../database/schema.js";
import { createParamValidator } from "../helpers/validator-helpers.js";
import type { JourneyStore } from "../store/journey-store.js";

const getNetworkByIdQuerySchema = z.object({
	id: z.coerce.number().min(0),
});

export const registerNetworkRoutes = (hono: Hono, store: JourneyStore) => {
	hono.get("/networks", async (c) => {
		const networkList = await database.select().from(networks);
		return c.json(networkList);
	});

	hono.get("/networks/:id", createParamValidator(getNetworkByIdQuerySchema), async (c) => {
		const { id } = c.req.valid("param");

		const [network] = await database.select().from(networks).where(eq(networks.id, id));
		if (typeof network === "undefined") return c.json({ error: `No network found with id '${id}'.` }, 404);

		const operatorList = await database.select().from(operators).where(eq(operators.networkId, network.id));
		const lineList = await database.select().from(lines).where(eq(lines.networkId, network.id));
		return c.json({
			...network,
			operators: operatorList.map(({ networkId, ...operator }) => operator),
			lines: lineList.map(({ networkId, ...line }) => line),
		});
	});

	hono.get("/networks/:id/stats", createParamValidator(getNetworkByIdQuerySchema), async (c) => {
		const { id } = c.req.valid("param");

		const [network] = await database.select().from(networks).where(eq(networks.id, id));
		if (typeof network === "undefined") return c.json({ error: `No network found with id '${id}'.` }, 404);

		const vehicleJourneys = store
			.values()
			.filter((journey) => journey.networkRef === network.ref)
			.toArray();

		return c.json({
			network,
			journeyCount: vehicleJourneys.length,
			vehicleCount: vehicleJourneys.filter((journey) => journey.position.type === "GPS").length,
		});
	});
};

import { count, eq } from "drizzle-orm";
import type { Hono } from "hono";
import * as z from "zod";

import { database } from "../database/database.js";
import { lines, networks, operators, vehicles } from "../database/schema.js";
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

		const onlineNetworkVehicles = store
			.values()
			.filter((journey) => journey.networkId === network.id)
			.toArray();

		const operatorList = await database.select().from(operators).where(eq(operators.networkId, network.id));
		const lineList = await database.select().from(lines).where(eq(lines.networkId, network.id));
		return c.json({
			...network,
			operators: operatorList.map(({ networkId, ...operator }) => operator),
			lines: lineList
				.toSorted((a, b) => {
					const sortOrderDiff = (a.sortOrder ?? lineList.length) - (b.sortOrder ?? lineList.length);
					return sortOrderDiff || Number.parseInt(a.number) - Number.parseInt(b.number);
				})
				.map(({ networkId, ...line }) => ({
					...line,
					onlineVehicleCount: onlineNetworkVehicles.filter(
						(journey) => journey.lineId === line.id && typeof journey.vehicle?.id !== "undefined",
					).length,
				})),
		});
	});

	hono.get("/networks/:id/stats", createParamValidator(getNetworkByIdQuerySchema), async (c) => {
		const { id } = c.req.valid("param");

		const [network] = await database.select().from(networks).where(eq(networks.id, id));
		if (typeof network === "undefined") return c.json({ error: `No network found with id '${id}'.` }, 404);

		const [vehicleCount] = await database
			.select({ value: count() })
			.from(vehicles)
			.where(eq(vehicles.networkId, network.id));

		const vehicleJourneys = store
			.values()
			.filter((journey) => journey.networkId === network.id)
			.toArray();

		return c.json({
			network,
			ongoingJourneyCount: vehicleJourneys.filter((journey) => typeof journey.lineId !== "undefined").length,
			onlineVehicleCount: vehicleJourneys.filter((journey) => journey.position.type === "GPS").length,
			totalVehicleCount: vehicleCount?.value ?? 0,
		});
	});
};

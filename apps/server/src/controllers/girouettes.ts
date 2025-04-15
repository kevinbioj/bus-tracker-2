import type { Hono } from "hono";
import { z } from "zod";

import { createQueryValidator } from "../helpers/validator-helpers.js";
import { findGirouette } from "../services/girouette-service.js";

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

		const girouette = findGirouette({ networkId, lineId, directionId, destination });
		return c.json(girouette ? [girouette] : []);
	});
};

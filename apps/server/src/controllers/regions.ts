import type { Hono } from "hono";

import { database } from "../database/database.js";
import { regions } from "../database/schema.js";

export const registerRegionRoutes = (hono: Hono) => {
	hono.get("/regions", async (c) => {
		const regionList = await database.select().from(regions);
		return c.json(regionList);
	});
};

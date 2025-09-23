import { asc } from "drizzle-orm";

import { database } from "../core/database/database.js";
import { regionsTable } from "../core/database/schema.js";

import { hono } from "../server.js";

hono.get("/regions", async (c) => {
	const regionList = await database.select().from(regionsTable).orderBy(asc(regionsTable.sortOrder));
	return c.json(regionList);
});

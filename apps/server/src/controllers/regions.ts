import { asc } from "drizzle-orm";

import { database } from "../database/database.js";
import { regionsTable } from "../database/schema.js";
import { hono } from "../server.js";

hono.get("/regions", async (c) => {
	const regionList = await database.select().from(regionsTable).orderBy(asc(regionsTable.sortOrder));
	return c.json(regionList);
});

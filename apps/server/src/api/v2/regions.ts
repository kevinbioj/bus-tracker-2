import { asc } from "drizzle-orm";
import { Hono } from "hono";

import { database } from "../../core/database/database.js";
import { regionsTable, type RegionEntity } from "../../core/database/schema.js";

const regionsApp = new Hono();

const regionEntityToRegionDto = (region: RegionEntity) => ({
	id: region.id,
	name: region.name,
	order: region.sortOrder,
});

regionsApp.get("/", async (c) => {
	const data = await database
		.select()
		.from(regionsTable)
		.orderBy(asc(regionsTable.sortOrder), asc(regionsTable.name), asc(regionsTable.id));

	const regions = data.map(regionEntityToRegionDto);
	return c.json(regions, 200);
});

export default regionsApp;

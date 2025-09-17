import { asc } from "drizzle-orm";

import { database } from "../../database/database.js";
import { regionsTable } from "../../database/schema.js";

import { regionToRegionDto } from "./regions.model.js";

export async function findAllRegions() {
	const results = await database.select().from(regionsTable).orderBy(asc(regionsTable.id));
	return results.map(regionToRegionDto);
}

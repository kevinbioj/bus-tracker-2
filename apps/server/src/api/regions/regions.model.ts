import type { RegionEntity } from "../../database/schema.js";

export const regionToRegionDto = (region: RegionEntity) => ({
	id: region.id,
	name: region.name,
	order: region.sortOrder,
});

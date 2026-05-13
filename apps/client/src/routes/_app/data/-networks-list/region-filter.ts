export const ALL_REGIONS_FILTER = "all";
export const OTHER_REGIONS_FILTER = "other";

export const SPECIAL_REGION_FILTERS = [ALL_REGIONS_FILTER, OTHER_REGIONS_FILTER] as const;

export type SpecialRegionFilter = (typeof SPECIAL_REGION_FILTERS)[number];
export type RegionFilter = SpecialRegionFilter | `${number}`;

export function isSpecialRegionFilter(value: string): value is SpecialRegionFilter {
	return SPECIAL_REGION_FILTERS.includes(value as SpecialRegionFilter);
}

export function toRegionFilter(value: string | null | undefined): RegionFilter {
	if (value === undefined || value === null || value.length === 0) {
		return ALL_REGIONS_FILTER;
	}

	if (isSpecialRegionFilter(value)) {
		return value;
	}

	const regionId = Number(value);
	return Number.isInteger(regionId) && regionId > 0 ? `${regionId}` : ALL_REGIONS_FILTER;
}

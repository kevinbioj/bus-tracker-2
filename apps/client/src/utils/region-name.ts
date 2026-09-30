import type { Region } from "~/api/regions";
import { getLocale } from "~/paraglide/runtime";

export function getRegionName(region: Region): string {
	return region.localizedNames?.[getLocale()] ?? region.name;
}

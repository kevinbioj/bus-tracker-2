import { getLocale } from "~/paraglide/runtime";

export function getRegionName(name: Record<string, string>): string {
	const locale = getLocale();

	return name[locale] ?? name.fr ?? Object.values(name)[0] ?? "";
}

import { baseLocale, isLocale, type Locale } from "../paraglide/runtime.js";

const crawlerPattern = /bot\/|crawler|spider|Google-InspectionTool/i;

export function resolveRequestLocale(userAgent: string | undefined, acceptLanguage: string | undefined): Locale {
	if (userAgent !== undefined && crawlerPattern.test(userAgent)) return baseLocale;
	if (acceptLanguage === undefined) return baseLocale;

	const ranges = acceptLanguage
		.split(",")
		.map((entry, index) => {
			const [range = "", ...parameters] = entry.trim().split(";");
			const quality = parameters
				.map((parameter) => /^\s*q\s*=\s*([\d.]+)\s*$/i.exec(parameter)?.[1])
				.find((value) => value !== undefined);
			return { language: range.trim().split("-")[0]?.toLowerCase() ?? "", quality: Number(quality ?? 1), index };
		})
		.filter(({ quality }) => quality > 0)
		.toSorted((a, b) => b.quality - a.quality || a.index - b.index);

	return ranges.map(({ language }) => language).find(isLocale) ?? baseLocale;
}

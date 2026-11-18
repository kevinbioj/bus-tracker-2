import {
	serviceAlertCauses,
	serviceAlertEffects,
	serviceAlertSeverities,
	type TranslatedText,
} from "@bus-tracker/contracts";
import * as z from "zod";

import type { ExposedServiceAlert } from "../../core/services/service-alert-service.js";

export const alertSchema = z.object({
	header: z.string().optional(),
	description: z.string().optional(),
	cause: z.enum(serviceAlertCauses).optional(),
	effect: z.enum(serviceAlertEffects).optional(),
	severity: z.enum(serviceAlertSeverities).optional(),
	activePeriods: z.array(z.object({ start: z.string().optional(), end: z.string().optional() })),
	url: z.string().optional(),
});

export function pickText(texts: TranslatedText | undefined, language = "fr") {
	return (
		texts?.find((text) => text.language?.toLowerCase().startsWith(language))?.text ??
		texts?.find((text) => text.language === undefined)?.text ??
		texts?.[0]?.text
	);
}

export function stripHtml(value: string | undefined) {
	return value
		?.replace(/<br\s*\/?>|<\/(?:p|div|li)>/gi, "\n")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

export function presentAlert(alert: ExposedServiceAlert): z.input<typeof alertSchema> {
	return {
		header: pickText(alert.header),
		description: stripHtml(pickText(alert.description)),
		cause: alert.cause,
		effect: alert.effect,
		severity: alert.severity,
		activePeriods: alert.activePeriods,
		url: pickText(alert.url),
	};
}

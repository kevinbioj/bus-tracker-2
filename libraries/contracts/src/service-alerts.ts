import { type } from "arktype";

/*
 * Info trafic, tenue dans Redis par les providers sur le modèle des stations : c'est une donnée du
 * flux temps réel, que chaque cycle remplace intégralement, et qui n'a pas sa place en base.
 */

/**
 * Hash des alertes : un champ `${providerId}:${sourceId}` par source, portant son dernier
 * {@link ServiceAlertsSnapshot}. Une source muette depuis trop longtemps y est ignorée par le serveur.
 */
export const SERVICE_ALERTS_KEY = "service-alerts";

export const serviceAlertsSnapshotField = (providerId: string, sourceId: string) => `${providerId}:${sourceId}`;

/** Texte traduit, tel que le publie GTFS-RT : une traduction par langue, la langue pouvant manquer. */
export const translatedTextSchema = type({
	text: "string",
	"language?": "string",
}).array();

export type TranslatedText = typeof translatedTextSchema.infer;

export const serviceAlertCauses = [
	"UNKNOWN_CAUSE",
	"OTHER_CAUSE",
	"TECHNICAL_PROBLEM",
	"STRIKE",
	"DEMONSTRATION",
	"ACCIDENT",
	"HOLIDAY",
	"WEATHER",
	"MAINTENANCE",
	"CONSTRUCTION",
	"POLICE_ACTIVITY",
	"MEDICAL_EMERGENCY",
	"SPECIAL_EVENT",
] as const;

export const serviceAlertCauseEnum = type.enumerated(...serviceAlertCauses);
export type ServiceAlertCause = typeof serviceAlertCauseEnum.infer;

export const serviceAlertEffects = [
	"NO_SERVICE",
	"REDUCED_SERVICE",
	"SIGNIFICANT_DELAYS",
	"DETOUR",
	"ADDITIONAL_SERVICE",
	"MODIFIED_SERVICE",
	"OTHER_EFFECT",
	"UNKNOWN_EFFECT",
	"STOP_MOVED",
	"NO_EFFECT",
	"ACCESSIBILITY_ISSUE",
] as const;

export const serviceAlertEffectEnum = type.enumerated(...serviceAlertEffects);
export type ServiceAlertEffect = typeof serviceAlertEffectEnum.infer;

export const serviceAlertSeverities = ["UNKNOWN_SEVERITY", "INFO", "WARNING", "SEVERE"] as const;

export const serviceAlertSeverityEnum = type.enumerated(...serviceAlertSeverities);
export type ServiceAlertSeverity = typeof serviceAlertSeverityEnum.infer;

/**
 * Ce que vise une alerte, sous la forme des références publiées par ailleurs (lignes, quais,
 * stations, courses). Les champs présents se combinent : une entité portant une ligne et un quai ne
 * vise que ce quai sur cette ligne. Une entité ne portant que `networkRef` vise tout le réseau.
 */
export const serviceAlertInformedEntitySchema = type({
	networkRef: "string",
	/** `${networkRef}:Line:${lineRef}` */
	"lineRef?": "string",
	/** Ne vaut qu'avec `lineRef`. */
	"direction?": "'OUTBOUND'|'INBOUND'",
	/** `${networkRef}:StopPoint:${stopRef}` */
	"stopRef?": "string",
	/** `${networkRef}:StopArea:${areaId}` */
	"stopAreaRef?": "string",
	/** `${networkRef}:ServiceJourney:${tripRef}` */
	"journeyRef?": "string",
	/** Date de service de la course visée : absente, la course est visée quelle que soit sa date. */
	"serviceDate?": "string.date",
});

export type ServiceAlertInformedEntity = typeof serviceAlertInformedEntitySchema.infer;

export const serviceAlertActivePeriodSchema = type({
	"start?": "string.date.iso",
	"end?": "string.date.iso",
});

export type ServiceAlertActivePeriod = typeof serviceAlertActivePeriodSchema.infer;

export const serviceAlertSchema = type({
	id: "string",
	"cause?": serviceAlertCauseEnum,
	"effect?": serviceAlertEffectEnum,
	"severity?": serviceAlertSeverityEnum,
	/** Périodes d'activité. Vide : l'alerte est active tant qu'elle est publiée. */
	activePeriods: serviceAlertActivePeriodSchema.array(),
	header: translatedTextSchema,
	/** Peut contenir du HTML : à assainir avant tout rendu. */
	"description?": translatedTextSchema,
	"url?": translatedTextSchema,
	informedEntities: serviceAlertInformedEntitySchema.array(),
});

export type ServiceAlert = typeof serviceAlertSchema.infer;

/**
 * Enveloppe d'un instantané, sans validation de ses alertes : le serveur les valide une à une, pour
 * qu'une valeur imprévue n'emporte pas toutes celles de la source.
 */
export const serviceAlertsSnapshotEnvelopeSchema = type({
	providerId: "string",
	sourceId: "string",
	alerts: "unknown[]",
	updatedAt: "string.date.iso",
});

export const serviceAlertsSnapshotSchema = type({
	providerId: "string",
	sourceId: "string",
	alerts: serviceAlertSchema.array(),
	updatedAt: "string.date.iso",
});

export type ServiceAlertsSnapshot = typeof serviceAlertsSnapshotSchema.infer;

/** Vrai lorsque l'une des périodes couvre l'instant donné, ou que l'alerte n'en déclare aucune. */
export function isServiceAlertActive(alert: Pick<ServiceAlert, "activePeriods">, atMs: number) {
	if (alert.activePeriods.length === 0) return true;
	return alert.activePeriods.some(
		({ start, end }) =>
			(start === undefined || Date.parse(start) <= atMs) && (end === undefined || atMs < Date.parse(end)),
	);
}

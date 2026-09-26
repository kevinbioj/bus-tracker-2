import {
	SERVICE_ALERTS_KEY,
	type ServiceAlert,
	type ServiceAlertCause,
	type ServiceAlertEffect,
	type ServiceAlertInformedEntity,
	type ServiceAlertSeverity,
	type ServiceAlertsSnapshot,
	serviceAlertCauses,
	serviceAlertEffects,
	serviceAlertSeverities,
	serviceAlertsSnapshotField,
	type TranslatedText,
} from "@bus-tracker/contracts";
import { captureException } from "@bus-tracker/monitoring";

import type { EntitySelector, IdentifiedAlert, TranslatedString } from "../model/gtfs-rt.js";
import type { Source } from "../model/source.js";
import type { Trip } from "../model/trip.js";
import { padSourceId } from "../utils/pad-source-id.js";
import { resolveSourceNetworkRefs } from "../utils/source-network-refs.js";
import { createTripNetworkResolver } from "../utils/trip-network-ref.js";

/** Seule l'écriture du hash est requise : évite d'exposer la variance des types du client Redis. */
type RedisHashWriter = { hSet: (key: string, field: string, value: string) => Promise<unknown> };

/**
 * Intervalle maximal entre deux écritures d'un même instantané, même inchangé : le serveur tient pour
 * arrêté un provider dont l'instantané vieillit, et cesse d'en servir les alertes.
 */
const HEARTBEAT_MS = 60_000;

const toTranslatedText = (value?: TranslatedString): TranslatedText | undefined => {
	const translations = (value?.translation ?? []).flatMap(({ text, language }) =>
		typeof text === "string" && text.trim().length > 0 ? [language ? { text, language } : { text }] : [],
	);
	return translations.length > 0 ? translations : undefined;
};

const toIsoString = (epochSeconds?: number) =>
	typeof epochSeconds === "number" && epochSeconds > 0
		? Temporal.Instant.fromEpochMilliseconds(epochSeconds * 1000).toString()
		: undefined;

/** `YYYYMMDD` (GTFS-RT) vers `YYYY-MM-DD`. */
const toServiceDate = (startDate?: string) =>
	startDate !== undefined && /^\d{8}$/.test(startDate)
		? `${startDate.slice(0, 4)}-${startDate.slice(4, 6)}-${startDate.slice(6, 8)}`
		: undefined;

/**
 * Une valeur d'énumération que le contrat ne connaît pas — ajoutée à la spec depuis, ou numérique
 * faute d'être connue des bindings — est écartée plutôt que publiée : l'effet retombe sur
 * `UNKNOWN_EFFECT`, la cause et la gravité sont omises.
 */
const knownValue = <T extends string>(values: readonly T[], value: unknown) =>
	(values as readonly unknown[]).includes(value) ? (value as T) : undefined;

const toDirection = (directionId?: number) =>
	directionId === 0 ? ("OUTBOUND" as const) : directionId === 1 ? ("INBOUND" as const) : undefined;

/**
 * Traduit les alertes lues dans le flux en alertes publiables : chaque identifiant GTFS y devient la
 * référence sous laquelle lignes, quais, stations et courses sont publiés par ailleurs, pour que le
 * serveur puisse les rapprocher sans rien connaître du GTFS. Une alerte terminée, ou dont rien n'a pu
 * être désigné, est écartée.
 */
export function buildServiceAlerts(source: Source, alerts: IdentifiedAlert[], now: Temporal.Instant): ServiceAlert[] {
	const gtfs = source.gtfs;
	if (gtfs === undefined || alerts.length === 0) return [];

	const { mapLineRef, mapStopRef, mapTripRef } = source.options;
	const networkOf = createTripNetworkResolver(source);
	const sourceNetworkRefs = resolveSourceNetworkRefs(source);
	const nowMs = now.epochMilliseconds;

	// Une route n'a de réseau qu'à travers ses courses : l'index n'est construit que si une alerte en vise une.
	let tripByRouteId: Map<string, Trip> | undefined;
	const networkRefsOfRoute = (routeId: string) => {
		if (tripByRouteId === undefined) {
			tripByRouteId = new Map();
			for (const trip of gtfs.trips.values()) {
				if (!tripByRouteId.has(trip.route.id)) tripByRouteId.set(trip.route.id, trip);
			}
		}
		const trip = tripByRouteId.get(routeId);
		return trip !== undefined ? [networkOf(trip)] : sourceNetworkRefs;
	};

	const lineRefOf = (networkRef: string, routeId: string) => `${networkRef}:Line:${mapLineRef?.(routeId) ?? routeId}`;
	const stopRefOf = (networkRef: string, stopId: string) => `${networkRef}:StopPoint:${mapStopRef?.(stopId) ?? stopId}`;

	/** Désignation d'un arrêt : un quai, ou une station et chacun de ses quais. */
	const stopTargetsOf = (networkRef: string, stopId: string): Partial<ServiceAlertInformedEntity>[] => {
		if (!gtfs.stops.has(stopId)) {
			const stopArea = gtfs.stopAreas.get(stopId);
			if (stopArea !== undefined) {
				return [
					{ stopAreaRef: `${networkRef}:StopArea:${stopArea.id}` },
					...stopArea.stops.map((stop) => ({ stopRef: stopRefOf(networkRef, stop.id) })),
				];
			}
		}
		return [{ stopRef: stopRefOf(networkRef, stopId) }];
	};

	const resolveSelector = (selector: EntitySelector): ServiceAlertInformedEntity[] => {
		const tripId = selector.trip?.tripId;
		const trip = tripId !== undefined ? gtfs.trips.get(tripId) : undefined;
		// Course inconnue du GTFS : rien ne permettrait de la reconnaître une fois publiée.
		if (tripId !== undefined && trip === undefined) return [];

		const routeId = selector.routeId ?? (trip === undefined ? selector.trip?.routeId : undefined);
		const directionId = selector.directionId ?? (trip === undefined ? selector.trip?.directionId : undefined);

		const networkRefs =
			trip !== undefined ? [networkOf(trip)] : routeId !== undefined ? networkRefsOfRoute(routeId) : sourceNetworkRefs;

		// Ne désigner qu'un type de route ne dit rien que l'on sache rapprocher.
		if (trip === undefined && routeId === undefined && selector.stopId === undefined) {
			if (selector.agencyId === undefined || selector.routeType !== undefined) return [];
		}

		return networkRefs.flatMap((networkRef) => {
			const base: ServiceAlertInformedEntity = { networkRef };

			if (trip !== undefined) {
				base.journeyRef = `${networkRef}:ServiceJourney:${mapTripRef?.(trip.id) ?? trip.id}`;
				const serviceDate = toServiceDate(selector.trip?.startDate);
				if (serviceDate !== undefined) base.serviceDate = serviceDate;
			}

			if (routeId !== undefined) {
				base.lineRef = lineRefOf(networkRef, routeId);
				const direction = toDirection(directionId);
				if (direction !== undefined) base.direction = direction;
			}

			if (selector.stopId === undefined) return [base];
			return stopTargetsOf(networkRef, selector.stopId).map((target) => ({ ...base, ...target }));
		});
	};

	return alerts.flatMap((alert) => {
		const activePeriods = (alert.activePeriod ?? []).flatMap(({ start, end }) => {
			const period = { start: toIsoString(start), end: toIsoString(end) };
			if (period.start === undefined && period.end === undefined) return [];
			return [
				{
					...(period.start !== undefined ? { start: period.start } : {}),
					...(period.end !== undefined ? { end: period.end } : {}),
				},
			];
		});

		// Toutes les périodes sont échues : l'alerte ne sera plus jamais active.
		if (activePeriods.length > 0 && activePeriods.every(({ end }) => end !== undefined && Date.parse(end) <= nowMs)) {
			return [];
		}

		const informedEntities = (alert.informedEntity ?? []).flatMap(resolveSelector);
		if (informedEntities.length === 0) return [];

		const header = toTranslatedText(alert.headerText);
		const description = toTranslatedText(alert.descriptionText);
		// Sans titre ni description, il n'y aurait rien à montrer.
		if (header === undefined && description === undefined) return [];

		const url = toTranslatedText(alert.url);
		const cause = knownValue<ServiceAlertCause>(serviceAlertCauses, alert.cause);
		const effect =
			alert.effect !== undefined
				? (knownValue<ServiceAlertEffect>(serviceAlertEffects, alert.effect) ?? "UNKNOWN_EFFECT")
				: undefined;
		const severity = knownValue<ServiceAlertSeverity>(serviceAlertSeverities, alert.severityLevel);

		return [
			{
				id: `${source.id}:${alert.id}`,
				...(cause !== undefined ? { cause } : {}),
				...(effect !== undefined ? { effect } : {}),
				...(severity !== undefined ? { severity } : {}),
				activePeriods,
				header: header ?? [],
				...(description !== undefined ? { description } : {}),
				...(url !== undefined ? { url } : {}),
				informedEntities,
			},
		];
	});
}

/** Dernier instantané écrit de chaque source, et l'instant de l'écriture. */
const lastPublished = new Map<string, { fingerprint: string; atMs: number }>();

/**
 * Écrit l'info trafic de chaque source dans Redis. Un instantané n'est réécrit que s'il a changé, ou
 * pour signaler que la source est toujours en vie. Une source qui n'a jamais publié d'alerte n'est
 * pas écrite ; celle dont les alertes ont toutes disparu l'est, pour les effacer.
 */
export async function publishServiceAlerts(redis: RedisHashWriter, providerId: string, sources: Source[]) {
	const now = Temporal.Now.instant();

	for (const source of sources) {
		try {
			const field = serviceAlertsSnapshotField(providerId, source.id);
			const previous = lastPublished.get(field);
			if (source.serviceAlerts.length === 0 && previous === undefined) continue;

			const alerts = buildServiceAlerts(source, source.serviceAlerts, now);
			const fingerprint = JSON.stringify(alerts);
			if (previous?.fingerprint === fingerprint && now.epochMilliseconds - previous.atMs < HEARTBEAT_MS) continue;

			const snapshot: ServiceAlertsSnapshot = {
				providerId,
				sourceId: source.id,
				alerts,
				updatedAt: now.toString(),
			};
			await redis.hSet(SERVICE_ALERTS_KEY, field, JSON.stringify(snapshot));
			lastPublished.set(field, { fingerprint, atMs: now.epochMilliseconds });

			if (previous?.fingerprint !== fingerprint) {
				console.log("%s ✓ Published %d service alerts.", padSourceId(source), alerts.length);
			}
		} catch (cause) {
			console.error(new Error(`Failed to publish service alerts for '${source.id}'.`, { cause }));
			captureException(cause);
		}
	}
}

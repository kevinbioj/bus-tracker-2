import {
	isServiceAlertActive,
	SERVICE_ALERTS_KEY,
	type ServiceAlert,
	type ServiceAlertEffect,
	type ServiceAlertInformedEntity,
	serviceAlertSchema,
	serviceAlertsSnapshotEnvelopeSchema,
} from "@bus-tracker/contracts";
import { ArkErrors } from "arktype";

import { redis } from "../../index.js";
import type { DisposeableVehicleJourney } from "../../types/disposeable-vehicle-journey.js";
import { useCache } from "../../utils/use-cache.js";
import { resolveLineRefs } from "./line-ref-service.js";
import type { StopArea } from "./stop-area-service.js";
import { resolveNetworkIds } from "./stop-area-service.js";

/**
 * Âge au-delà duquel l'instantané d'une source est tenu pour abandonné : son provider le réécrit au
 * moins chaque minute tant qu'il tourne, et un provider arrêté ne doit pas laisser d'alertes derrière lui.
 */
const SNAPSHOT_MAX_AGE_MS = 10 * 60_000;

/** Alerte telle que servie au client : ce qu'elle vise n'a servi qu'au rapprochement. */
export type ExposedServiceAlert = Omit<ServiceAlert, "informedEntities">;

type ResolvedInformedEntity = ServiceAlertInformedEntity & {
	/** Absent : le réseau n'existe pas (encore) en base. */
	networkId?: number;
	/** Absent : la ligne n'existe pas (encore) en base, l'entité ne désigne alors aucune ligne connue. */
	lineId?: number;
};

type LoadedServiceAlert = {
	alert: ExposedServiceAlert;
	entities: ResolvedInformedEntity[];
};

/**
 * Les alertes changent au rythme du flux, sondé chaque minute par les providers : une demi-minute de
 * cache épargne Redis et la base sans rien retarder de sensible.
 */
const alertsCache = useCache<LoadedServiceAlert[]>(30_000);

async function loadServiceAlerts(): Promise<LoadedServiceAlert[]> {
	const cached = alertsCache.get("all");
	if (cached !== undefined) return cached;
	if (!redis.isReady) return [];

	const rawSnapshots = await redis.hGetAll(SERVICE_ALERTS_KEY);
	const nowMs = Date.now();

	const alerts: ServiceAlert[] = [];
	const staleFields: string[] = [];
	for (const [field, rawSnapshot] of Object.entries(rawSnapshots)) {
		let snapshot: ReturnType<typeof serviceAlertsSnapshotEnvelopeSchema>;
		try {
			snapshot = serviceAlertsSnapshotEnvelopeSchema(JSON.parse(rawSnapshot));
		} catch {
			continue;
		}

		if (snapshot instanceof ArkErrors) {
			console.warn("⚠ Rejected a malformed service alerts snapshot for '%s':", field, snapshot.toString());
			continue;
		}

		if (nowMs - Date.parse(snapshot.updatedAt) > SNAPSHOT_MAX_AGE_MS) {
			staleFields.push(field);
			continue;
		}

		// Une à une : une valeur imprévue n'écarte que l'alerte qui la porte, pas toute la source.
		for (const rawAlert of snapshot.alerts) {
			const alert = serviceAlertSchema(rawAlert);
			if (alert instanceof ArkErrors) {
				console.warn("⚠ Rejected a malformed service alert from '%s':", field, alert.toString());
				continue;
			}
			alerts.push(alert);
		}
	}

	if (staleFields.length > 0) {
		void redis.hDel(SERVICE_ALERTS_KEY, staleFields).catch(() => void 0);
	}

	const entities = alerts.flatMap(({ informedEntities }) => informedEntities);
	const [networkIds, lines] = await Promise.all([
		resolveNetworkIds(entities.map(({ networkRef }) => networkRef)),
		resolveLineRefs(entities.flatMap(({ lineRef }) => (lineRef !== undefined ? [lineRef] : []))),
	]);

	const loaded = alerts.map(({ informedEntities, ...alert }) => ({
		alert,
		entities: informedEntities.map((entity) => ({
			...entity,
			networkId: networkIds.get(entity.networkRef) ?? undefined,
			lineId: entity.lineRef !== undefined ? lines.get(entity.lineRef)?.id : undefined,
		})),
	}));

	alertsCache.set("all", loaded);
	return loaded;
}

const targetsStop = (entity: ResolvedInformedEntity) =>
	entity.stopRef !== undefined || entity.stopAreaRef !== undefined;

const targetsWholeNetwork = (entity: ResolvedInformedEntity) =>
	entity.lineRef === undefined && entity.journeyRef === undefined && !targetsStop(entity);

/** Les plus pénalisantes d'abord : une interruption passe devant un ascenseur en panne. */
const EFFECT_RANKS: Record<ServiceAlertEffect, number> = {
	NO_SERVICE: 0,
	REDUCED_SERVICE: 1,
	SIGNIFICANT_DELAYS: 1,
	DETOUR: 1,
	STOP_MOVED: 2,
	MODIFIED_SERVICE: 2,
	ADDITIONAL_SERVICE: 3,
	ACCESSIBILITY_ISSUE: 3,
	OTHER_EFFECT: 4,
	UNKNOWN_EFFECT: 4,
	NO_EFFECT: 5,
};

const startOf = (alert: ExposedServiceAlert) =>
	Math.min(...alert.activePeriods.map(({ start }) => (start !== undefined ? Date.parse(start) : 0)), Infinity);

/** Alertes actives dont une entité satisfait le prédicat, les plus pénalisantes puis les plus récentes d'abord. */
async function findServiceAlerts(predicate: (entity: ResolvedInformedEntity) => boolean) {
	const nowMs = Date.now();
	return (await loadServiceAlerts())
		.filter(({ alert, entities }) => isServiceAlertActive(alert, nowMs) && entities.some(predicate))
		.map(({ alert }) => alert)
		.sort(
			(a, b) =>
				(EFFECT_RANKS[a.effect ?? "UNKNOWN_EFFECT"] ?? 4) - (EFFECT_RANKS[b.effect ?? "UNKNOWN_EFFECT"] ?? 4) ||
				startOf(b) - startOf(a),
		);
}

/**
 * Info trafic d'une station, ou d'un de ses quais : ce qui vise l'arrêt lui-même — pas les lignes qui
 * le desservent, qui feraient d'un détour de ligne une alerte à chacun de ses arrêts — et ce qui vise
 * tout un réseau de la station.
 */
export function findStopAlerts(stopArea: StopArea, stopRefs: Set<string>) {
	return findServiceAlerts((entity) => {
		if (targetsStop(entity)) {
			return (entity.stopRef !== undefined && stopRefs.has(entity.stopRef)) || entity.stopAreaRef === stopArea.ref;
		}
		return (
			targetsWholeNetwork(entity) && entity.networkId !== undefined && stopArea.networkIds.includes(entity.networkId)
		);
	});
}

/**
 * Info trafic d'une course : ce qui la vise, elle, sa ligne dans son sens, ou tout son réseau. Les
 * alertes d'arrêt n'en sont pas, par cohérence avec le tableau des passages.
 */
export function findJourneyAlerts(journey: DisposeableVehicleJourney) {
	return findServiceAlerts((entity) => {
		if (targetsStop(entity)) return false;

		if (entity.journeyRef !== undefined) {
			if (entity.journeyRef !== journey.journeyRef) return false;
			if (entity.serviceDate !== undefined && entity.serviceDate !== journey.serviceDate) return false;
		}

		if (entity.lineRef !== undefined) {
			if (entity.lineId === undefined || entity.lineId !== journey.lineId) return false;
			if (entity.direction !== undefined && entity.direction !== journey.direction) return false;
		}

		if (targetsWholeNetwork(entity)) return entity.networkId === journey.networkId;
		return true;
	});
}

/** Info trafic d'une ligne, tous sens et tous arrêts confondus, et celle de tout son réseau. */
export function findLineAlerts(line: { networkId: number; references: string[] | null }) {
	const references = new Set(line.references ?? []);
	return findServiceAlerts((entity) => {
		if (entity.lineRef !== undefined) return references.has(entity.lineRef);
		return targetsWholeNetwork(entity) && entity.networkId === line.networkId;
	});
}

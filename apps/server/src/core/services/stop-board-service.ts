import {
	getCallOnDemand,
	isRefOf,
	localIdOf,
	type StopAreaMode,
	type StopCallDirection,
	type StopDeparture,
	type StopPoint,
	type VehicleJourneyCall,
} from "@bus-tracker/contracts";

import { useCache } from "../../utils/use-cache.js";
import { journeyStore } from "../store/journey-store.js";
import { findLinesRefs, type ResolvedLine, resolveLineRefs } from "./line-ref-service.js";
import { findStopAlerts } from "./service-alert-service.js";
import {
	findStopArea,
	findStopAreaOfStopPoint,
	findStopAreasWithin,
	invalidateStopAreaManifests,
	type StopArea,
} from "./stop-area-service.js";
import { requestStopDepartures, type StopDeparturesResult } from "./stop-departures-service.js";

/** Plafond de stations servies en une fois : au-delà, l'emprise est trop large pour être lisible. */
const MARKERS_LIMIT = 1_500;

/** Portée du tableau de passages, alignée sur celle du processeur. */
const DEPARTURES_HORIZON_MS = 2 * 60 * 60 * 1000;

export const DEPARTURES_LIMIT = 15;

/**
 * Au-delà, la position d'un véhicule est jugée figée — le véhicule s'est délocalisé : elle ne dit
 * plus ni où il en est de sa course, ni s'il stationne à l'arrêt.
 */
const STALE_POSITION_MS = 5 * 60 * 1000;

export type StopMarker = {
	ref: string;
	name: string;
	latitude: number;
	longitude: number;
	lineRefs: string[];
	mode: StopAreaMode;
	/** Réseau principal : il distingue sur la carte deux stations homonymes de réseaux différents. */
	networkId: number;
	stopPoints?: PublicStopPoint[];
};

type PublicStopPoint = Omit<StopPoint, "lineRefs"> & { lines?: ResolvedLine[] };

/** Quais tels que servis au client : leurs lignes n'ont servi qu'au filtre. */
const publicStopPoints = (stopPoints: StopPoint[]) => stopPoints.map(({ lineRefs, ...stopPoint }) => stopPoint);

const markerStopPoints = (
	stopPoints: StopPoint[],
	areaLineRefs: string[],
	lines: Map<string, ResolvedLine>,
): PublicStopPoint[] =>
	stopPoints.map(({ lineRefs = areaLineRefs, ...stopPoint }) => ({
		...stopPoint,
		lines: lineRefs.flatMap((lineRef) => lines.get(lineRef) ?? []),
	}));

/** Source d'une station, sous la forme `${providerId}:${sourceId}`. */
const sourceKeyOf = ({ providerId, sourceId }: { providerId: string; sourceId: string }) => `${providerId}:${sourceId}`;

/**
 * L'inventaire ne bouge qu'au rythme des ressources GTFS : une minute de cache est sans risque. Chaque
 * entrée retient les sources de ses stations, pour n'être oubliée qu'à la republication de l'une d'elles.
 */
const markersCache = useCache<{ items: StopMarker[]; sourceKeys: Set<string> }>(60_000, 64);

export type StopMarkersFilter = {
	swLat: number;
	swLon: number;
	neLat: number;
	neLon: number;
	networkIds?: number[];
	lineIds?: number[];
	withStopPoints: boolean;
};

export async function buildStopMarkers({
	swLat,
	swLon,
	neLat,
	neLon,
	networkIds,
	lineIds,
	withStopPoints,
}: StopMarkersFilter) {
	const lineRefs = lineIds !== undefined ? new Set(await findLinesRefs(lineIds)) : undefined;
	const stopAreas = await findStopAreasWithin(
		{ swLat, swLon, neLat, neLon },
		{ limit: MARKERS_LIMIT, networkIds, lineRefs: lineRefs !== undefined ? [...lineRefs] : undefined },
	);

	const lines =
		lineRefs !== undefined || withStopPoints
			? await resolveLineRefs(
					stopAreas.flatMap((stopArea) =>
						(stopArea.stopPoints ?? []).flatMap((stopPoint) => stopPoint.lineRefs ?? stopArea.lineRefs),
					),
				)
			: new Map<string, ResolvedLine>();

	const items: StopMarker[] = stopAreas.map(
		({ ref, name, latitude, longitude, lineRefs: areaLineRefs, mode, networkId: areaNetworkId, stopPoints = [] }) => ({
			ref,
			name,
			latitude,
			longitude,
			lineRefs: areaLineRefs,
			// Fiche publiée avant l'apparition du mode : un bus, le temps qu'elle soit republiée.
			mode: mode ?? "BUS",
			networkId: areaNetworkId,
			// Sur une ligne filtrée, la carte ne montre que ses quais, à tout zoom : ils sont toujours servis.
			// Un quai publié sans ses lignes reprend celles de sa station, qui en est.
			...(lineRefs !== undefined
				? {
						stopPoints: markerStopPoints(
							stopPoints.filter(
								(stopPoint) =>
									stopPoint.lineRefs === undefined || stopPoint.lineRefs.some((lineRef) => lineRefs.has(lineRef)),
							),
							areaLineRefs,
							lines,
						),
					}
				: withStopPoints
					? { stopPoints: markerStopPoints(stopPoints, areaLineRefs, lines) }
					: {}),
		}),
	);

	return { items, sourceKeys: new Set(stopAreas.map(sourceKeyOf)) };
}

export type ResolvedDeparture = Omit<StopDeparture, "lineRef"> & {
	/** Absente d'un passage qui ne vient que du suivi : la ligne y est déjà résolue. */
	lineRef?: string;
	/**
	 * Seule l'identité de la ligne voyage avec le passage : son numéro, ses couleurs et son
	 * pictogramme sont connus du client par `/networks/:id`, qu'il garde en cache.
	 */
	lineId?: number;
	/**
	 * Réseau de la ligne : il n'est pas forcément parmi ceux de la station, et le client doit savoir
	 * quel réseau demander pour la retrouver.
	 */
	lineNetworkId?: number;
	/** Vrai lorsque la course est effectivement suivie par l'application à cet instant. */
	tracked: boolean;
	/** Vrai lorsque le véhicule stationne en ce moment à l'arrêt. */
	atStop: boolean;
};

/**
 * Clé de rapprochement entre un passage théorique et la course qui l'assure. L'identifiant de
 * publication ne suffit pas : une course suivie en GPS est publiée sous une clé de véhicule, que le
 * processeur ne peut pas deviner. Sa course théorique, elle, est la même de part et d'autre.
 */
function journeyKeyOf(departure: { journeyRef?: string; serviceDate?: string }) {
	if (departure.journeyRef === undefined) return;
	return `${departure.journeyRef}|${departure.serviceDate ?? ""}`;
}

/**
 * Heures d'un passage dans le sens du tableau. L'arrivée n'est publiée à part que lorsqu'elle diffère
 * du départ : sinon, c'est l'heure de la desserte.
 */
function callTimesOf(call: VehicleJourneyCall, direction: StopCallDirection) {
	if (direction === "arrivals" && call.aimedArrivalTime !== undefined) {
		return { aimedTime: call.aimedArrivalTime, expectedTime: call.expectedArrivalTime };
	}
	return { aimedTime: call.aimedTime, expectedTime: call.expectedTime };
}

/**
 * Complète la réponse du provider par les courses réellement suivies. Elle prend le relais lorsque
 * le provider ne répond pas, et couvre à elle seule ce que l'horaire théorique ignore : les courses
 * supplémentaires, les dessertes ajoutées par une déviation, et les véhicules suivis en GPS dont
 * aucune course théorique ne porte la trace.
 */
function mergeTrackedJourneys(
	stopArea: StopArea,
	stopRefs: Set<string>,
	{ departures, excludedJourneys, passedCallDetection }: StopDeparturesResult,
	nowMs: number,
	direction: StopCallDirection,
) {
	const untilMs = nowMs + DEPARTURES_HORIZON_MS;
	const stationStopRefs = new Set(stopArea.stopRefs);

	const merged: ResolvedDeparture[] = departures.map((departure) => ({ ...departure, tracked: false, atStop: false }));

	const byJourneyId = new Map(
		merged.flatMap((departure) => (departure.journeyId !== undefined ? [[departure.journeyId, departure]] : [])),
	);
	const byJourneyKey = new Map(
		merged.flatMap((departure) => {
			const key = journeyKeyOf(departure);
			return key !== undefined ? [[key, departure] as const] : [];
		}),
	);

	// Courses que la configuration de la source a écartées du tableau : elles ne doivent pas y revenir
	// par le suivi.
	const excludedJourneyIds = new Set(
		excludedJourneys.flatMap(({ journeyId }) => (journeyId !== undefined ? [journeyId] : [])),
	);
	const excludedJourneyKeys = new Set(
		excludedJourneys.flatMap((excluded) => {
			const key = journeyKeyOf(excluded);
			return key !== undefined ? [key] : [];
		}),
	);

	// Passages que le véhicule associé a déjà dépassés, d'après sa progression plutôt que l'heure.
	const passed = new Set<ResolvedDeparture>();

	for (const journey of journeyStore.values()) {
		if (!stopArea.networkIds.includes(journey.networkId)) continue;

		const journeyKey = journeyKeyOf(journey);
		if (excludedJourneyIds.has(journey.id) || (journeyKey !== undefined && excludedJourneyKeys.has(journeyKey))) {
			continue;
		}

		// Pour un véhicule suivi en GPS, le processeur ne publie que les dessertes à partir de son
		// arrêt courant (séquence, à défaut identifiant d'arrêt) : la liste publiée *est* sa
		// progression. Une desserte qui y figure n'est pas encore passée, quelle que soit l'heure — tant
		// que la position est fraîche : figée, elle retient la course sur des arrêts déjà desservis, et
		// le passage est alors jugé sur l'horaire.
		const freshPosition = nowMs - Date.parse(journey.position.recordedAt) <= STALE_POSITION_MS;
		const followsVehicle = passedCallDetection === "VEHICLE" && journey.position.type === "GPS" && freshPosition;

		const known = byJourneyId.get(journey.id) ?? (journeyKey !== undefined ? byJourneyKey.get(journeyKey) : undefined);
		if (known?.canceled === true) continue;

		// Les dessertes publiées commencent à l'arrêt en cours : le véhicule stationne à la station
		// lorsqu'il est à l'arrêt et que la première desserte encore assurée en fait partie.
		const currentCall = journey.calls?.find((call) => call.callStatus !== "SKIPPED");
		const lastCall = journey.calls?.at(-1);
		// Terminus effectif : une déviation ou le temps réel peuvent avoir retiré les derniers arrêts.
		const terminusCall = journey.calls?.findLast((call) => call.callStatus !== "SKIPPED");
		// Course en temps réel : au moins une de ses dessertes publiées en porte un horaire.
		const realtime = journey.calls?.some((call) => call.expectedTime !== undefined) ? true : undefined;

		// Une déviation peut troquer un quai de la station contre un arrêt provisoire : la course la dessert
		// toujours, c'est l'arrêt provisoire qui compte — le provider n'annonce plus que lui.
		const stationCalls = journey.calls?.filter((call) => stationStopRefs.has(call.stopRef)) ?? [];
		const relocated =
			stationCalls.some((call) => call.relocated === true) ||
			(stationCalls.some((call) => call.callStatus === "UNSCHEDULED") &&
				stationCalls.some((call) => call.callStatus === "SKIPPED"));

		let matched = false;
		for (const call of journey.calls ?? []) {
			if (!stopRefs.has(call.stopRef)) continue;
			if (relocated && call.callStatus === "SKIPPED") continue;
			// Comme dans le processeur : ni le terminus, théorique ou effectif, où la course s'achève, ni
			// un arrêt interdit à la montée ne sont des départs. Les dessertes publiées partant de l'arrêt
			// courant, le terminus de départ n'y figure plus une fois la course partie : à l'arrivée, seul
			// l'arrêt interdit à la descente est écarté, le provider écartant l'origine des passages connus.
			if (direction === "arrivals") {
				if (call.flags?.includes("NO_DROP_OFF")) continue;
			} else if (call === lastCall || call === terminusCall || call.flags?.includes("NO_PICKUP")) {
				continue;
			}

			const atStop = freshPosition && journey.position.atStop && call === currentCall;
			const { aimedTime, expectedTime } = callTimesOf(call, direction);

			// Un véhicule à quai reste affiché même si son heure de départ est dépassée : il est là. Il
			// en va de même, si la source le demande, de tout véhicule qui n'a pas encore atteint l'arrêt.
			const effectiveMs = Date.parse(expectedTime ?? aimedTime);
			if (Number.isNaN(effectiveMs) || effectiveMs > untilMs) continue;
			if (effectiveMs < nowMs && !atStop && !followsVehicle) continue;

			matched = true;

			if (known !== undefined) {
				known.tracked = true;
				known.atStop = atStop;
				known.journeyId = journey.id;
				// La course suivie connaît sa ligne, même quand la référence du processeur n'a rien donné.
				if (journey.lineId !== undefined) {
					known.lineId = journey.lineId;
					known.lineNetworkId = journey.networkId;
				}
				// Le store tient l'état le plus récent de la course : ses heures priment sur celles que
				// le processeur a calculées pour répondre.
				known.expectedTime = expectedTime ?? known.expectedTime;
				known.callStatus = call.callStatus;
				// Les dessertes publiées partent de l'arrêt courant : le processeur, qui voit la course
				// entière, a pu y trouver du temps réel que celles-ci n'ont plus.
				known.realtime = known.realtime ?? realtime;
				// Les dessertes publiées vont jusqu'au terminus : la course suivie sait où elle s'achève.
				if (direction === "arrivals") known.terminus = call === terminusCall;
				known.platformName = call.platformName ?? known.platformName;
				// Calculée avec le véhicule effectivement affecté, elle est la plus juste des deux.
				known.destination = journey.destination ?? known.destination;
				// Code mission et accessibilité peuvent dépendre du véhicule affecté : ceux de la course
				// suivie priment, ceux du processeur à défaut.
				known.missionCode = journey.missionCode ?? known.missionCode;
				known.wheelchairAccessible = journey.wheelchairAccessible ?? known.wheelchairAccessible;
				break;
			}

			const departure: ResolvedDeparture = {
				tracked: true,
				atStop,
				stopRef: call.stopRef,
				stopName: call.stopName,
				platformName: call.platformName,
				lineId: journey.lineId,
				lineNetworkId: journey.lineId !== undefined ? journey.networkId : undefined,
				destination: journey.destination,
				missionCode: journey.missionCode,
				wheelchairAccessible: journey.wheelchairAccessible,
				aimedTime,
				expectedTime,
				callStatus: call.callStatus,
				temporary: call.temporary === true || (relocated && call.callStatus === "UNSCHEDULED") ? true : undefined,
				relocated: call.relocated === true || (relocated && call.callStatus === "UNSCHEDULED") ? true : undefined,
				onDemand: direction === "arrivals" ? undefined : getCallOnDemand(call.flags),
				realtime,
				terminus: direction === "arrivals" ? call === terminusCall : undefined,
				journeyId: journey.id,
				journeyRef: journey.journeyRef,
				serviceDate: journey.serviceDate,
			};
			merged.push(departure);
			byJourneyId.set(journey.id, departure);
			if (journeyKey !== undefined) byJourneyKey.set(journeyKey, departure);
			break;
		}

		// Le véhicule a déjà dépassé la station, même si l'heure prévue n'est pas encore atteinte (il
		// est en avance sur le temps réel annoncé) : le passage n'est plus à venir.
		if (followsVehicle && !matched && known !== undefined) {
			passed.add(known);
		}
	}

	// Le provider garde un départ tardif de terminus tant que sa course est publiée : il n'est à venir
	// que si le véhicule suivi y attend encore.
	return merged.filter(
		(departure) =>
			!passed.has(departure) &&
			(departure.tracked ||
				departure.origin !== true ||
				Date.parse(departure.expectedTime ?? departure.aimedTime) >= nowMs),
	);
}

async function resolveLineIds(departures: ResolvedDeparture[]) {
	const lines = await resolveLineRefs(
		departures.flatMap((departure) =>
			departure.lineId === undefined && departure.lineRef !== undefined ? [departure.lineRef] : [],
		),
	);

	for (const departure of departures) {
		if (departure.lineId !== undefined || departure.lineRef === undefined) continue;
		const line = lines.get(departure.lineRef);
		departure.lineId = line?.id;
		departure.lineNetworkId = line?.networkId;
	}
}

/**
 * Le client sonde le tableau toutes les 5 s : le cache, plus court, ne fait que mutualiser les
 * demandes simultanées de plusieurs visiteurs sur une même station sans rendre de réponse périmée.
 */
const departuresCache = useCache<StopBoard>(4_000, 1_024);

/** La station elle-même ne change qu'avec la ressource GTFS. */
const stopAreasCache = useCache<StopArea | null>(300_000, 4_096);

/**
 * Oublie stations, marqueurs et tableaux en cache : appelé dès qu'un provider republie l'inventaire
 * d'une source, pour ne pas servir quelques minutes encore une station que sa ressource a supprimée.
 *
 * Seul ce qui provient de la source est oublié : des dizaines de sources republient chacune à leur
 * rythme, et tout vider à chaque fois laisserait les caches presque toujours froids. Une station que la
 * source vient d'ajouter n'apparaît donc dans un cadrage déjà en cache qu'à son expiration, une minute
 * au plus. Sans source désignée, tout est oublié.
 */
const stopAreasInvalidationListeners = new Set<() => void>();

export function onStopAreasInvalidated(listener: () => void) {
	stopAreasInvalidationListeners.add(listener);
	return () => stopAreasInvalidationListeners.delete(listener);
}

export function invalidateStopAreaCaches(source?: { providerId: string; sourceId: string }) {
	invalidateStopAreaManifests(source);
	for (const listener of stopAreasInvalidationListeners) listener();
	// Les tableaux ne vivent que quelques secondes : inutile de les trier par source.
	departuresCache.clear();

	if (source === undefined) {
		markersCache.clear();
		stopAreasCache.clear();
		return;
	}

	const sourceKey = sourceKeyOf(source);
	markersCache.deleteWhere(({ sourceKeys }) => sourceKeys.has(sourceKey));
	// Une référence restée sans station a pu être créée par cette publication.
	stopAreasCache.deleteWhere((stopArea) => stopArea === null || sourceKeyOf(stopArea) === sourceKey);
}

/**
 * Références des quais sur lesquels porte le tableau. Un quai n'est publié que sous le réseau
 * principal de sa station, alors que chaque course désigne ses dessertes sous le sien : il est
 * retrouvé sous tous les réseaux de la station.
 */
function stopRefsOf(stopArea: StopArea, stopPointRef?: string) {
	if (stopPointRef === undefined) return new Set(stopArea.stopRefs);
	const stopId = localIdOf(stopPointRef, "StopPoint");
	return new Set([stopPointRef, ...stopArea.stopRefs.filter((stopRef) => localIdOf(stopRef, "StopPoint") === stopId)]);
}

/**
 * Station désignée par `ref`, et le quai sur lequel se restreindre si `ref` en désigne un : le client
 * n'a ainsi qu'une référence à porter, quelle que soit la sélection. `stopRefs` sont les références des
 * quais concernés, sous tous les réseaux de la station.
 */
export async function resolveStop(ref: string) {
	const stopPointRef = isRefOf(ref, "StopPoint") ? ref : undefined;
	if (stopPointRef === undefined && !isRefOf(ref, "StopArea")) return undefined;

	const stopArea = await stopAreasCache.getOrLoad(
		ref,
		async () => (await (stopPointRef !== undefined ? findStopAreaOfStopPoint(ref) : findStopArea(ref))) ?? null,
	);
	if (stopArea === null) return undefined;

	return { stopArea, stopPointRef, stopRefs: stopRefsOf(stopArea, stopPointRef) };
}

function toStopDeparturesPayload(
	stopArea: StopArea,
	stopPointRef: string | undefined,
	departures: ResolvedDeparture[],
	lineIds: number[] | undefined,
) {
	return {
		// La position permet au client de garder la station sélectionnée visible à tout niveau de zoom.
		stop: {
			ref: stopArea.ref,
			name: stopArea.name,
			latitude: stopArea.latitude,
			longitude: stopArea.longitude,
			mode: stopArea.mode ?? "BUS",
			// Le tableau propose aussi les arrivées : la source l'a voulu pour cette station.
			arrivals: stopArea.arrivals === true,
			networkId: stopArea.networkId,
			// Tous les réseaux de la station : le client en tire numéros et couleurs des lignes.
			networkIds: stopArea.networkIds,
			stopPoints: publicStopPoints(stopArea.stopPoints ?? []),
		},
		// Quai sur lequel le tableau est restreint, s'il l'est.
		stopPointRef,
		// Les références internes n'ont servi qu'au rapprochement : le client n'en a pas l'usage.
		// Un passage dont la ligne reste inconnue n'aurait qu'un « ? » à montrer : il est écarté, avant la
		// limite pour que le tableau reste plein — comme, sur une ligne filtrée, ceux des autres lignes.
		departures: departures
			.filter(
				(departure) => departure.lineId !== undefined && (lineIds === undefined || lineIds.includes(departure.lineId)),
			)
			.slice(0, DEPARTURES_LIMIT)
			.map(({ lineRef, journeyRef, serviceDate, ...departure }) => departure),
		at: Temporal.Now.instant(),
	};
}

export type StopDeparturesPayload = ReturnType<typeof toStopDeparturesPayload>;

export type StopBoard = {
	stopArea: StopArea;
	stopPointRef?: string;
	departures: ResolvedDeparture[];
	payload: StopDeparturesPayload;
};

type StopBoardResult = { board: StopBoard } | { status: 400 | 404; error: string };

const departuresInFlight = new Map<string, Promise<StopBoardResult>>();

export async function loadStopBoard(
	ref: string,
	direction: StopCallDirection,
	lineIds?: number[],
): Promise<StopBoardResult> {
	const cacheKey = `${ref}|${direction}|${lineIds?.join(",") ?? ""}`;
	const cached = departuresCache.get(cacheKey);
	if (cached !== undefined) return { board: cached };

	let inFlight = departuresInFlight.get(cacheKey);
	if (inFlight === undefined) {
		inFlight = computeStopBoard(cacheKey, ref, direction, lineIds).finally(() => departuresInFlight.delete(cacheKey));
		departuresInFlight.set(cacheKey, inFlight);
	}
	return inFlight;
}

export async function buildStopDepartures(ref: string, direction: StopCallDirection, lineIds?: number[]) {
	const result = await loadStopBoard(ref, direction, lineIds);
	if ("error" in result) return { status: result.status, error: result.error };
	return { payload: result.board.payload };
}

async function computeStopBoard(
	cacheKey: string,
	ref: string,
	direction: StopCallDirection,
	lineIds: number[] | undefined,
): Promise<StopBoardResult> {
	const lineRefs = lineIds !== undefined ? await findLinesRefs(lineIds) : undefined;
	if (lineRefs !== undefined && lineRefs.length === 0) {
		return { status: 400, error: `No line was found with id '${lineIds?.join("', '")}'.` };
	}

	const stop = await resolveStop(ref);
	if (stop === undefined) {
		return { status: 404, error: `No stop area was found for ref "${ref}".` };
	}
	const { stopArea, stopPointRef, stopRefs } = stop;
	if (direction === "arrivals" && stopArea.arrivals !== true) {
		return { status: 400, error: `Stop area "${stopArea.ref}" does not offer arrivals.` };
	}

	const nowMs = Date.now();
	const departures = mergeTrackedJourneys(
		stopArea,
		stopRefs,
		await requestStopDepartures({
			providerId: stopArea.providerId,
			sourceId: stopArea.sourceId,
			stopAreaRef: stopArea.ref,
			stopRef: stopPointRef,
			// Le provider écarte les autres lignes avant sa limite : le tableau reste plein.
			lineRefs,
			direction,
		}),
		nowMs,
		direction,
	);
	await resolveLineIds(departures);

	departures.sort((a, b) => Date.parse(a.expectedTime ?? a.aimedTime) - Date.parse(b.expectedTime ?? b.aimedTime));

	const board: StopBoard = {
		stopArea,
		stopPointRef,
		departures,
		payload: toStopDeparturesPayload(stopArea, stopPointRef, departures, lineIds),
	};

	departuresCache.set(cacheKey, board);
	return { board };
}

export async function buildStopAlerts(ref: string) {
	const stop = await resolveStop(ref);
	if (stop === undefined) return undefined;

	// Un quai choisi ne perd pas l'info trafic de sa station : celle-ci le vise aussi.
	return findStopAlerts(stop.stopArea, stop.stopRefs);
}

/** Marqueurs de l'emprise, arrondie pour que deux cadrages voisins partagent la même entrée de cache. */
export async function findStopMarkers(filter: StopMarkersFilter) {
	const { swLat, swLon, neLat, neLon, networkIds, lineIds, withStopPoints } = filter;
	const cacheKey = [swLat, swLon, neLat, neLon]
		.map((bound) => bound.toFixed(3))
		.concat(networkIds?.join(",") ?? "", lineIds?.join(",") ?? "", String(withStopPoints))
		.join("|");

	return (await markersCache.getOrLoad(cacheKey, () => buildStopMarkers(filter))).items;
}

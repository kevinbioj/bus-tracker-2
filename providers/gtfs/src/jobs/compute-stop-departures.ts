import type { ExcludedStopDepartureJourney, StopCallDirection, StopDeparture } from "@bus-tracker/contracts";

import { getEpochMsFromSecs } from "../cache/temporal-cache.js";
import { getJourneyKey } from "../model/gtfs.js";
import type { Journey, JourneyCall } from "../model/journey.js";
import type { Source } from "../model/source.js";
import type { Trip } from "../model/trip.js";
import { formatCallTime } from "../utils/format-call-time.js";
import { getWheelchairAccessible } from "../utils/get-wheelchair-accessible.js";
import { createTripNetworkResolver } from "../utils/trip-network-ref.js";

/** Portée par défaut du tableau de passages : au-delà, l'horaire théorique n'intéresse plus. */
const DEFAULT_HORIZON_MS = 2 * 60 * 60 * 1000;

const DEFAULT_LIMIT = 15;

/**
 * Retard au-delà duquel un départ de terminus n'est plus gardé pour le serveur : un véhicule qui
 * attendrait encore n'est plus vraisemblable, et ces départs ne doivent pas encombrer la réponse.
 */
const LATE_DEPARTURE_MAX_MS = 30 * 60 * 1000;

/** Bits de `StopTimeStore.flagsBitmask` marquant un arrêt interdit à la montée, à la descente. */
const NO_PICKUP_FLAG = 1;
const NO_DROP_OFF_FLAG = 2;

/**
 * Marge appliquée au pré-filtrage par heure : les bornes de la fenêtre sont d'abord ramenées en
 * secondes depuis minuit avec le fuseau d'une course représentative de la station, alors qu'un pôle
 * d'échange peut en réunir plusieurs — et qu'un changement d'heure décale ce minuit. Le tri final se
 * fait, lui, sur les instants réellement calculés course par course.
 */
const WINDOW_SLACK_SECS = 2 * 60 * 60;

/** Premier index de `entries` dont l'heure de départ atteint `secs`. Les entrées y sont triées. */
function lowerBound(entries: [number, number][], departureSecs: Uint32Array, secs: number) {
	let low = 0;
	let high = entries.length;
	while (low < high) {
		const middle = (low + high) >>> 1;
		if (departureSecs[entries[middle]![0]]! < secs) {
			low = middle + 1;
		} else {
			high = middle;
		}
	}
	return low;
}

function findCallForStop(calls: JourneyCall[], stopId: string, sequence: number) {
	// La séquence prime — un service peut desservir deux fois le même arrêt — mais une déviation
	// réécrit les dessertes : on retombe alors sur l'identifiant d'arrêt.
	return (
		calls.find((call) => call.sequence === sequence && call.stop.id === stopId) ??
		calls.find((call) => call.stop.id === stopId)
	);
}

/** Dernière desserte assurée de la course : son terminus effectif, où elle s'achève. */
function findTerminusCall(calls: JourneyCall[]) {
	return calls.findLast((call) => call.status !== "SKIPPED");
}

/** Première desserte assurée de la course : son terminus de départ effectif, d'où elle part. */
function findOriginCall(calls: JourneyCall[]) {
	return calls.find((call) => call.status !== "SKIPPED");
}

/**
 * Arrêt provisoire : desserte ajoutée par une déviation dans une station dont la course ne dessert
 * plus un autre quai. Le véhicule s'y arrête à la place de celui-ci.
 */
function isTemporaryCall(call: JourneyCall, calls: JourneyCall[], areaStopIds: Set<string>) {
	return (
		call.modification === "ADDED" &&
		areaStopIds.has(call.stop.id) &&
		calls.some((other) => other.status === "SKIPPED" && areaStopIds.has(other.stop.id))
	);
}

/** Quai supprimé de la station, que remplace un arrêt provisoire de la même station. */
function isReplacedByTemporaryCall(call: JourneyCall, calls: JourneyCall[], areaStopIds: Set<string>) {
	return call.status === "SKIPPED" && calls.some((other) => isTemporaryCall(other, calls, areaStopIds));
}

function resolveDestination(trip: Trip, stopTimeIdx: number, call?: JourneyCall) {
	const { store } = trip;
	const lastStop = store.getStop(store.tripStart[trip.idx]! + store.tripCount[trip.idx]! - 1);
	return call?.headsign ?? store.getStopHeadsign(stopTimeIdx) ?? trip.headsign ?? lastStop?.name;
}

export type ComputeStopDeparturesOptions = {
	limit?: number;
	horizonMs?: number;
	/** Restreint le tableau à un quai de la station, sous la forme publiée de son `stopRef`. */
	stopRef?: string;
	/** Restreint le tableau aux passages de ces lignes, sous la forme publiée de leur `lineRef`. */
	lineRefs?: string[];
	/** Départs (par défaut) ou arrivées. */
	direction?: StopCallDirection;
};

/**
 * Prochains passages à une station : l'horaire théorique du GTFS, corrigé du temps réel pour les
 * courses qui en portent. Seul le processeur détient ces deux informations à la fois — le serveur ne
 * connaît que les courses déjà en circulation.
 *
 * Au départ, ni le terminus où la course s'achève ni un arrêt interdit à la montée ; à l'arrivée,
 * symétriquement, ni le terminus d'où elle part ni un arrêt interdit à la descente — et les heures
 * sont celles d'arrivée.
 */
export function computeStopDepartures(
	source: Source,
	areaId: string,
	at: Temporal.Instant,
	{
		limit = DEFAULT_LIMIT,
		horizonMs = DEFAULT_HORIZON_MS,
		stopRef: onlyStopRef,
		lineRefs,
		direction = "departures",
	}: ComputeStopDeparturesOptions = {},
): { departures: StopDeparture[]; excludedJourneys: ExcludedStopDepartureJourney[] } {
	const gtfs = source.gtfs;
	if (gtfs === undefined) return { departures: [], excludedJourneys: [] };

	// Station créée ou complétée par le flux temps réel, à défaut station du GTFS statique.
	const stopArea = source.realtimeStopAreas.get(areaId) ?? gtfs.stopAreas.get(areaId);
	if (stopArea === undefined) return { departures: [], excludedJourneys: [] };

	const entries = Array.from(gtfs.stopIndex.entriesOf(areaId));

	const arrivals = direction === "arrivals";
	const { stopTimeStore } = gtfs;
	const { arrivalSecs, departureSecs, flagsBitmask, sequence } = stopTimeStore;

	const referenceTimeZone =
		(entries.length > 0 ? gtfs.tripsByIdx[entries[0]![1]]?.route.agency.timeZone : undefined) ??
		gtfs.routes.values().next().value?.agency.timeZone ??
		"UTC";
	const nowMs = at.epochMilliseconds;
	const untilMs = nowMs + horizonMs;
	// Le serveur juge alors un passage sur la progression du véhicule : il saura écarter un départ
	// tardif dont le véhicule est déjà parti.
	const followsVehicle = source.options.passedCallDetection === "VEHICLE";

	const today = at.toZonedDateTimeISO(referenceTimeZone).toPlainDate();
	const dates = [today.subtract({ days: 1 }), today, today.add({ days: 1 })];

	const departures: (Omit<StopDeparture, "destination"> & {
		sortKey: number;
		/** Départ de terminus à l'heure dépassée, gardé pour le serveur : il ne compte pas dans la limite. */
		late: boolean;
		resolveDestination: () => string | undefined;
		/** Provenance, résolue seulement pour les arrivées. */
		resolveOriginName: () => string | undefined;
		/** Course du passage, fabriquée à la demande pour les courses sans état. */
		resolveJourney: () => Journey;
	})[] = [];

	const { mapLineRef, mapStopRef, mapTripRef } = source.options;
	// Le réseau est celui de chaque course : une station peut être desservie par plusieurs.
	const networkOf = createTripNetworkResolver(source);
	const stopRefOf = (networkRef: string, stopId: string) => `${networkRef}:StopPoint:${mapStopRef?.(stopId) ?? stopId}`;

	// Quai demandé, quel que soit le réseau qui préfixe sa référence : la même borne porte une
	// référence par réseau qui la dessert.
	const onlyStopId =
		onlyStopRef !== undefined
			? stopArea.stops.find((stop) => onlyStopRef.endsWith(`:StopPoint:${mapStopRef?.(stop.id) ?? stop.id}`))?.id
			: undefined;
	if (onlyStopRef !== undefined && onlyStopId === undefined) return { departures: [], excludedJourneys: [] };

	const areaStopIds = new Set(stopArea.stops.map(({ id }) => id));
	/**
	 * Au tableau de la station, une course qui troque un quai contre un arrêt provisoire de la même
	 * station la dessert toujours : seul l'arrêt provisoire est annoncé. Le quai supprimé ne l'est plus
	 * qu'à son propre tableau.
	 */
	const isHiddenSkippedCall = (call: JourneyCall, calls: JourneyCall[]) =>
		onlyStopId === undefined && isReplacedByTemporaryCall(call, calls, areaStopIds);

	/** Dessertes déjà rendues par l'index, pour ne pas les redoubler depuis les courses déviées. */
	const emittedCalls = new Set<string>();

	const excludedJourneys: ExcludedStopDepartureJourney[] = [];
	/**
	 * À l'arrivée, une course qui part de la station n'y arrive pas : elle est signalée comme écartée,
	 * pour que le serveur ne la réintroduise pas depuis ses dessertes publiées, qui commencent à son
	 * terminus de départ tant qu'elle n'en est pas partie.
	 */
	const excludeOriginJourney = (trip: Trip, date: Temporal.PlainDate, journey?: Journey) => {
		excludedJourneys.push({
			journeyId: journey?.lastPublishedKey?.replaceAll("/", "_"),
			journeyRef: `${networkOf(trip, journey)}:ServiceJourney:${mapTripRef?.(trip.id) ?? trip.id}`,
			serviceDate: date.toString(),
		});
	};

	/**
	 * Un véhicule suivi qui attend encore à son terminus de départ, son heure passée, part en retard :
	 * le départ reste annoncé comme tel. Le serveur, qui seul sait quelles courses sont suivies — le
	 * véhicule peut être publié par une autre source —, l'écarte si aucun véhicule n'y attend.
	 */
	const isLateDepartureKept = (effectiveMs: number) => followsVehicle && nowMs - effectiveMs <= LATE_DEPARTURE_MAX_MS;

	for (const date of dates) {
		const midnightMs = getEpochMsFromSecs(date, 0, referenceTimeZone);
		const fromSecs = (nowMs - midnightMs) / 1000 - WINDOW_SLACK_SECS;
		const untilSecs = (untilMs - midnightMs) / 1000 + WINDOW_SLACK_SECS;
		if (untilSecs < 0) continue;

		for (let index = lowerBound(entries, departureSecs, fromSecs); index < entries.length; index += 1) {
			const [stopTimeIdx, tripIdx] = entries[index]!;
			if (departureSecs[stopTimeIdx]! > untilSecs) break;

			const trip = gtfs.tripsByIdx[tripIdx];
			if (trip === undefined) continue;

			// L'index tient tous les stop_times : on ne part pas du dernier, on n'arrive pas au premier.
			if ((flagsBitmask[stopTimeIdx]! & (arrivals ? NO_DROP_OFF_FLAG : NO_PICKUP_FLAG)) !== 0) continue;
			const atTheoreticalTerminus =
				stopTimeIdx === (arrivals ? trip.stopTimeStart : trip.stopTimeStart + trip.stopTimeCount - 1);
			if (atTheoreticalTerminus && !arrivals) continue;

			if (!trip.service.runsOn(date)) continue;

			const stop = stopTimeStore.getStop(stopTimeIdx);

			const timeZone = trip.route.agency.timeZone;
			const aimedMs = getEpochMsFromSecs(date, (arrivals ? arrivalSecs : departureSecs)[stopTimeIdx]!, timeZone);

			// Les arrêts ne sont matérialisés que lorsqu'ils ont quelque chose à dire de plus que
			// l'horaire théorique : les matérialiser tous rendrait le calcul bien plus coûteux que la
			// réponse ne le mérite.
			const journeyKey = getJourneyKey(date, trip.id);
			// Course supprimée : annoncée à son horaire théorique, sans le temps réel ni la déviation
			// qu'elle a pu porter avant sa suppression.
			const canceled = source.canceledJourneyKeys.has(journeyKey);
			const journey = canceled ? undefined : gtfs.journeys.get(journeyKey);
			// Un TripUpdate peut ne porter que des suppressions d'arrêts, sans aucun horaire : la course n'a
			// alors pas de temps réel, mais ses arrêts ont bien quelque chose à dire.
			const call =
				journey !== undefined &&
				(journey.hasRealtime() || journey.hasModifications() || journey.lastTripUpdateAtMs !== undefined)
					? findCallForStop(journey.calls, stop.id, sequence[stopTimeIdx]!)
					: undefined;

			// Une déviation peut avoir retiré la desserte : la course ne passe plus là.
			if (journey?.hasModifications() && call === undefined) continue;

			if (atTheoreticalTerminus) {
				excludeOriginJourney(trip, date, journey);
				continue;
			}

			if (call !== undefined && isHiddenSkippedCall(call, journey!.calls)) continue;

			// Le quai désigné par le temps réel remplace celui de l'horaire : c'est là que la course passe.
			const servedStop = call?.assignedStop ?? stop;
			if (onlyStopId !== undefined && servedStop.id !== onlyStopId) continue;

			// Le terminus théorique est déjà écarté, pas celui qu'avancent une déviation ou le temps réel en
			// retirant les premiers ou derniers arrêts : la course en part ou s'y achève désormais.
			if (call !== undefined && call === (arrivals ? findOriginCall : findTerminusCall)(journey!.calls)) {
				if (arrivals) excludeOriginJourney(trip, date, journey);
				continue;
			}

			const networkRef = networkOf(trip, journey);
			const stopRef = stopRefOf(networkRef, servedStop.id);

			// Terminus de départ : la première desserte assurée de la course, qu'une déviation peut avoir
			// déplacée. Sans arrêts matérialisés, c'est le premier stop_time de la course. Sans objet à
			// l'arrivée, où il est toujours écarté.
			const origin = arrivals
				? undefined
				: call !== undefined
					? call === findOriginCall(journey!.calls)
					: stopTimeIdx === trip.stopTimeStart;

			const expectedMs = arrivals ? call?.expectedArrivalTime : call?.expectedDepartureTime;
			const effectiveMs = expectedMs ?? aimedMs;
			if (effectiveMs > untilMs) continue;
			const late = effectiveMs < nowMs;
			if (late && !(origin && isLateDepartureKept(effectiveMs))) continue;
			// Terminus de la course, symétriquement : sa dernière desserte assurée, qu'une déviation peut
			// avoir avancée. Sans objet au départ, où il est toujours écarté.
			const terminus = arrivals
				? call !== undefined
					? call === findTerminusCall(journey!.calls)
					: stopTimeIdx === trip.stopTimeStart + trip.stopTimeCount - 1
				: undefined;

			emittedCalls.add(`${journeyKey}|${stop.id}`);
			departures.push({
				sortKey: effectiveMs,
				late,
				stopRef,
				stopName: servedStop.name,
				platformName: call?.platform ?? stop.platformCode,
				lineRef: `${networkRef}:Line:${mapLineRef?.(trip.route.id) ?? trip.route.id}`,
				// Résolue après tri et troncature : `getDestination` peut matérialiser les arrêts de la
				// course, inutile de le faire pour des passages qui ne seront pas rendus.
				resolveDestination: () =>
					source.options.getDestination?.(
						journey ?? trip.getScheduledJourney(date, true),
						journey?.vehicleDescriptor,
					) ?? resolveDestination(trip, stopTimeIdx, call),
				resolveOriginName: () =>
					(journey !== undefined ? findOriginCall(journey.calls)?.stop.name : undefined) ??
					stopTimeStore.getStop(trip.stopTimeStart)?.name,
				resolveJourney: () => journey ?? trip.getScheduledJourney(date, true),
				wheelchairAccessible: getWheelchairAccessible(trip, journey?.vehicleDescriptor),
				aimedTime: formatCallTime(aimedMs, stop.timeZone, timeZone),
				expectedTime: expectedMs !== undefined ? formatCallTime(expectedMs, stop.timeZone, timeZone) : undefined,
				callStatus: canceled ? "SKIPPED" : (call?.status ?? "SCHEDULED"),
				canceled: canceled ? true : undefined,
				temporary: call !== undefined && isTemporaryCall(call, journey!.calls, areaStopIds) ? true : undefined,
				realtime: journey?.hasRealtime() ? true : undefined,
				origin,
				terminus,
				// Les identifiants publiés remplacent leurs barres obliques côté serveur : la valeur
				// rendue ici doit pouvoir être comparée telle quelle à celles du store des courses.
				journeyId: journey?.lastPublishedKey?.replaceAll("/", "_"),
				journeyRef: `${networkRef}:ServiceJourney:${mapTripRef?.(trip.id) ?? trip.id}`,
				serviceDate: date.toString(),
			});
		}
	}

	// Dessertes ajoutées par une déviation : absentes de l'index théorique, elles ne sont connues que
	// des courses déviées — y compris celles des arrêts créés à la volée par le flux temps réel.
	for (const journeyKey of source.modifiedJourneyKeys) {
		if (source.canceledJourneyKeys.has(journeyKey)) continue;
		const journey = gtfs.journeys.get(journeyKey);
		if (journey === undefined) continue;

		const { calls, trip, date } = journey;
		const timeZone = trip.route.agency.timeZone;
		const originCall = findOriginCall(calls);
		const terminusCall = findTerminusCall(calls);

		for (const [index, call] of calls.entries()) {
			if (!areaStopIds.has(call.stop.id)) continue;
			// Ni le terminus, théorique ou effectif — d'arrivée au départ, de départ à l'arrivée — ni un
			// arrêt interdit à la montée (à la descente), ni une desserte déjà rendue par l'index.
			if (arrivals) {
				if (index === 0 || call === originCall) {
					excludeOriginJourney(trip, date, journey);
					continue;
				}
				if (call.flags.includes("NO_DROP_OFF")) continue;
			} else if (index === calls.length - 1 || call === terminusCall || call.flags.includes("NO_PICKUP")) {
				continue;
			}
			if (emittedCalls.has(`${journeyKey}|${call.stop.id}`) || isHiddenSkippedCall(call, calls)) continue;

			const servedStop = call.assignedStop ?? call.stop;
			if (onlyStopId !== undefined && servedStop.id !== onlyStopId) continue;

			const networkRef = networkOf(trip, journey);
			const stopRef = stopRefOf(networkRef, servedStop.id);

			const aimedMs = arrivals ? call.aimedArrivalTime : call.aimedDepartureTime;
			const expectedMs = arrivals ? call.expectedArrivalTime : call.expectedDepartureTime;
			const effectiveMs = expectedMs ?? aimedMs;
			if (effectiveMs > untilMs) continue;
			const late = effectiveMs < nowMs;
			if (late && !(call === originCall && isLateDepartureKept(effectiveMs))) continue;

			departures.push({
				sortKey: effectiveMs,
				late,
				stopRef,
				stopName: servedStop.name,
				platformName: call.platform ?? call.stop.platformCode,
				lineRef: `${networkRef}:Line:${mapLineRef?.(trip.route.id) ?? trip.route.id}`,
				resolveDestination: () =>
					source.options.getDestination?.(journey, journey.vehicleDescriptor) ??
					call.headsign ??
					trip.headsign ??
					calls.findLast((candidate) => candidate.status !== "SKIPPED")?.stop.name,
				resolveOriginName: () => originCall?.stop.name,
				resolveJourney: () => journey,
				wheelchairAccessible: getWheelchairAccessible(trip, journey.vehicleDescriptor),
				aimedTime: formatCallTime(aimedMs, call.stop.timeZone, timeZone),
				expectedTime: expectedMs !== undefined ? formatCallTime(expectedMs, call.stop.timeZone, timeZone) : undefined,
				callStatus: call.status,
				temporary: isTemporaryCall(call, calls, areaStopIds) ? true : undefined,
				realtime: journey.hasRealtime() ? true : undefined,
				origin: arrivals ? undefined : call === originCall,
				terminus: arrivals ? call === terminusCall : undefined,
				journeyId: journey.lastPublishedKey?.replaceAll("/", "_"),
				journeyRef: `${networkRef}:ServiceJourney:${mapTripRef?.(trip.id) ?? trip.id}`,
				serviceDate: date.toString(),
			});
		}
	}

	departures.sort((a, b) => a.sortKey - b.sortKey);

	const { filterStopDeparture, getMissionCode, getVehicleRef, hasRealVehicles, mapStopDeparture } = source.options;
	const kept: StopDeparture[] = [];
	let keptOnTime = 0;
	const onlyLineRefs = lineRefs !== undefined ? new Set(lineRefs) : undefined;

	// Les passages sont résolus un à un jusqu'à la limite : ceux que le filtre écarte laissent leur
	// place aux suivants, sans matérialiser la destination ni la course des passages qui ne seront pas
	// rendus.
	for (const { sortKey, late, resolveDestination, resolveOriginName, resolveJourney, ...rest } of departures) {
		if (keptOnTime >= limit) break;
		// Une autre ligne que celle demandée laisse sa place, comme un passage écarté par le filtre — sans
		// être signalée au serveur : il ne retient lui-même que les courses de la ligne.
		if (onlyLineRefs !== undefined && !onlyLineRefs.has(rest.lineRef)) continue;

		// La course n'est fabriquée qu'une fois, et seulement si la configuration en a l'usage.
		let journey: Journey | undefined;
		const journeyOf = () => {
			journey ??= resolveJourney();
			return journey;
		};

		let departure: StopDeparture = {
			...rest,
			destination: resolveDestination(),
			originName: arrivals ? resolveOriginName() : undefined,
			missionCode: getMissionCode?.(journeyOf(), journeyOf().vehicleDescriptor) ?? undefined,
			// Sans véhicule réel, le numéro de véhicule publié est celui de la course : le numéro de train.
			journeyNumber:
				hasRealVehicles === false
					? (getVehicleRef?.(journeyOf().vehicleDescriptor, journeyOf()) ?? undefined)
					: undefined,
		};
		if (mapStopDeparture !== undefined || filterStopDeparture !== undefined) {
			departure = mapStopDeparture?.(departure, journeyOf()) ?? departure;

			if (filterStopDeparture?.(departure, journeyOf()) === false) {
				const { journeyId, journeyRef, serviceDate } = departure;
				excludedJourneys.push({ journeyId, journeyRef, serviceDate });
				continue;
			}
		}

		kept.push(departure);
		if (!late) keptOnTime += 1;
	}

	return { departures: kept, excludedJourneys };
}

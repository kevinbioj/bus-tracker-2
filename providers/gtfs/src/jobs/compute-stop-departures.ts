import type { ExcludedStopDepartureJourney, StopDeparture } from "@bus-tracker/contracts";

import { createZonedDateTimeFromSecs } from "../cache/temporal-cache.js";
import { getJourneyKey } from "../model/gtfs.js";
import type { Journey, JourneyCall } from "../model/journey.js";
import type { Source } from "../model/source.js";
import type { Trip } from "../model/trip.js";
import { formatCallTime } from "../utils/format-call-time.js";
import { createTripNetworkResolver } from "../utils/trip-network-ref.js";

/** Portée par défaut du tableau de passages : au-delà, l'horaire théorique n'intéresse plus. */
const DEFAULT_HORIZON_MS = 2 * 60 * 60 * 1000;

const DEFAULT_LIMIT = 15;

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

function resolveDestination(trip: Trip, stopTimeIdx: number, call?: JourneyCall) {
	const { stopHeadsigns, stops, tripStart, tripCount } = trip.store;
	const lastStop = stops[tripStart[trip.idx]! + tripCount[trip.idx]! - 1];
	return call?.headsign ?? stopHeadsigns?.[stopTimeIdx] ?? trip.headsign ?? lastStop?.name;
}

export type ComputeStopDeparturesOptions = {
	limit?: number;
	horizonMs?: number;
	/** Restreint le tableau à un quai de la station, sous la forme publiée de son `stopRef`. */
	stopRef?: string;
};

/**
 * Prochains passages à une station : l'horaire théorique du GTFS, corrigé du temps réel pour les
 * courses qui en portent. Seul le processeur détient ces deux informations à la fois — le serveur ne
 * connaît que les courses déjà en circulation.
 */
export function computeStopDepartures(
	source: Source,
	areaId: string,
	at: Temporal.Instant,
	{ limit = DEFAULT_LIMIT, horizonMs = DEFAULT_HORIZON_MS, stopRef: onlyStopRef }: ComputeStopDeparturesOptions = {},
): { departures: StopDeparture[]; excludedJourneys: ExcludedStopDepartureJourney[] } {
	const gtfs = source.gtfs;
	if (gtfs === undefined) return { departures: [], excludedJourneys: [] };

	// Station du GTFS statique, ou arrêt créé à la volée par le flux temps réel.
	const stopArea = gtfs.stopAreas.get(areaId) ?? source.realtimeStopAreas.get(areaId);
	if (stopArea === undefined) return { departures: [], excludedJourneys: [] };

	const entries = Array.from(gtfs.stopIndex.entriesOf(areaId));

	const { departureSecs, sequence, stops } = gtfs.stopTimeStore;

	const referenceTimeZone =
		(entries.length > 0 ? gtfs.tripsByIdx[entries[0]![1]]?.route.agency.timeZone : undefined) ??
		gtfs.routes.values().next().value?.agency.timeZone ??
		"UTC";
	const nowMs = at.epochMilliseconds;
	const untilMs = nowMs + horizonMs;

	const today = at.toZonedDateTimeISO(referenceTimeZone).toPlainDate();
	const dates = [today.subtract({ days: 1 }), today, today.add({ days: 1 })];

	const departures: (Omit<StopDeparture, "destination"> & {
		sortKey: number;
		resolveDestination: () => string | undefined;
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

	/** Dessertes déjà rendues par l'index, pour ne pas les redoubler depuis les courses déviées. */
	const emittedCalls = new Set<string>();

	for (const date of dates) {
		const midnightMs = createZonedDateTimeFromSecs(date, 0, referenceTimeZone).epochMilliseconds;
		const fromSecs = (nowMs - midnightMs) / 1000 - WINDOW_SLACK_SECS;
		const untilSecs = (untilMs - midnightMs) / 1000 + WINDOW_SLACK_SECS;
		if (untilSecs < 0) continue;

		for (let index = lowerBound(entries, departureSecs, fromSecs); index < entries.length; index += 1) {
			const [stopTimeIdx, tripIdx] = entries[index]!;
			if (departureSecs[stopTimeIdx]! > untilSecs) break;

			const trip = gtfs.tripsByIdx[tripIdx];
			if (trip === undefined) continue;
			if (!trip.service.runsOn(date)) continue;

			const stop = stops[stopTimeIdx]!;
			if (onlyStopId !== undefined && stop.id !== onlyStopId) continue;

			const timeZone = trip.route.agency.timeZone;
			const aimedMs = createZonedDateTimeFromSecs(date, departureSecs[stopTimeIdx]!, timeZone).epochMilliseconds;

			// Les arrêts ne sont matérialisés que lorsqu'ils ont quelque chose à dire de plus que
			// l'horaire théorique : les matérialiser tous rendrait le calcul bien plus coûteux que la
			// réponse ne le mérite.
			const journeyKey = getJourneyKey(date, trip.id);
			const journey = gtfs.journeys.get(journeyKey);
			const call =
				journey !== undefined && (journey.hasRealtime() || journey.hasModifications())
					? findCallForStop(journey.calls, stop.id, sequence[stopTimeIdx]!)
					: undefined;

			// Une déviation peut avoir retiré la desserte : la course ne passe plus là.
			if (journey?.hasModifications() && call === undefined) continue;

			// L'index écarte le terminus théorique, pas celui qu'avancent une déviation ou le temps réel en
			// retirant les derniers arrêts : la course s'y achève désormais, elle n'en part pas.
			if (call !== undefined && call === findTerminusCall(journey!.calls)) continue;

			const networkRef = networkOf(trip, journey);
			const stopRef = stopRefOf(networkRef, stop.id);

			const expectedMs = call?.expectedDepartureTime;
			const effectiveMs = expectedMs ?? aimedMs;
			if (effectiveMs < nowMs || effectiveMs > untilMs) continue;

			// Terminus de départ : la première desserte assurée de la course, qu'une déviation peut avoir
			// déplacée. Sans arrêts matérialisés, c'est le premier stop_time de la course.
			const origin =
				call !== undefined
					? call === journey!.calls.find((candidate) => candidate.status !== "SKIPPED")
					: stopTimeIdx === trip.stopTimeStart;

			emittedCalls.add(`${journeyKey}|${stop.id}`);
			departures.push({
				sortKey: effectiveMs,
				stopRef,
				stopName: stop.name,
				platformName: call?.platform ?? stop.platformCode,
				lineRef: `${networkRef}:Line:${mapLineRef?.(trip.route.id) ?? trip.route.id}`,
				// Résolue après tri et troncature : `getDestination` peut matérialiser les arrêts de la
				// course, inutile de le faire pour des passages qui ne seront pas rendus.
				resolveDestination: () =>
					source.options.getDestination?.(
						journey ?? trip.getScheduledJourney(date, true),
						journey?.vehicleDescriptor,
					) ?? resolveDestination(trip, stopTimeIdx, call),
				resolveJourney: () => journey ?? trip.getScheduledJourney(date, true),
				aimedTime: formatCallTime(aimedMs, stop.timeZone, timeZone),
				expectedTime: expectedMs !== undefined ? formatCallTime(expectedMs, stop.timeZone, timeZone) : undefined,
				callStatus: call?.status ?? "SCHEDULED",
				origin,
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
	const areaStopIds = new Set(stopArea.stops.map(({ id }) => id));
	for (const journeyKey of source.modifiedJourneyKeys) {
		const journey = gtfs.journeys.get(journeyKey);
		if (journey === undefined) continue;

		const { calls, trip, date } = journey;
		const timeZone = trip.route.agency.timeZone;
		const originCall = calls.find((candidate) => candidate.status !== "SKIPPED");
		const terminusCall = findTerminusCall(calls);

		for (const [index, call] of calls.entries()) {
			if (!areaStopIds.has(call.stop.id)) continue;
			// Ni le terminus, théorique ou effectif, ni un arrêt interdit à la montée, ni une desserte déjà
			// rendue par l'index.
			if (index === calls.length - 1 || call === terminusCall || call.flags.includes("NO_PICKUP")) continue;
			if (emittedCalls.has(`${journeyKey}|${call.stop.id}`)) continue;

			if (onlyStopId !== undefined && call.stop.id !== onlyStopId) continue;

			const networkRef = networkOf(trip, journey);
			const stopRef = stopRefOf(networkRef, call.stop.id);

			const effectiveMs = call.expectedDepartureTime ?? call.aimedDepartureTime;
			if (effectiveMs < nowMs || effectiveMs > untilMs) continue;

			departures.push({
				sortKey: effectiveMs,
				stopRef,
				stopName: call.stop.name,
				platformName: call.platform ?? call.stop.platformCode,
				lineRef: `${networkRef}:Line:${mapLineRef?.(trip.route.id) ?? trip.route.id}`,
				resolveDestination: () =>
					source.options.getDestination?.(journey, journey.vehicleDescriptor) ??
					call.headsign ??
					trip.headsign ??
					calls.findLast((candidate) => candidate.status !== "SKIPPED")?.stop.name,
				resolveJourney: () => journey,
				aimedTime: formatCallTime(call.aimedDepartureTime, call.stop.timeZone, timeZone),
				expectedTime:
					call.expectedDepartureTime !== undefined
						? formatCallTime(call.expectedDepartureTime, call.stop.timeZone, timeZone)
						: undefined,
				callStatus: call.status,
				origin: call === originCall,
				journeyId: journey.lastPublishedKey?.replaceAll("/", "_"),
				journeyRef: `${networkRef}:ServiceJourney:${mapTripRef?.(trip.id) ?? trip.id}`,
				serviceDate: date.toString(),
			});
		}
	}

	departures.sort((a, b) => a.sortKey - b.sortKey);

	const { filterStopDeparture, mapStopDeparture } = source.options;
	const kept: StopDeparture[] = [];
	const excludedJourneys: ExcludedStopDepartureJourney[] = [];

	// Les passages sont résolus un à un jusqu'à la limite : ceux que le filtre écarte laissent leur
	// place aux suivants, sans matérialiser la destination ni la course des passages qui ne seront pas
	// rendus.
	for (const { sortKey, resolveDestination, resolveJourney, ...rest } of departures) {
		if (kept.length >= limit) break;

		let departure: StopDeparture = { ...rest, destination: resolveDestination() };
		if (mapStopDeparture !== undefined || filterStopDeparture !== undefined) {
			const journey = resolveJourney();
			departure = mapStopDeparture?.(departure, journey) ?? departure;

			if (filterStopDeparture?.(departure, journey) === false) {
				const { journeyId, journeyRef, serviceDate } = departure;
				excludedJourneys.push({ journeyId, journeyRef, serviceDate });
				continue;
			}
		}

		kept.push(departure);
	}

	return { departures: kept, excludedJourneys };
}

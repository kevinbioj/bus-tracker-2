import type { StopDeparture } from "@bus-tracker/contracts";

import { createZonedDateTimeFromSecs } from "../cache/temporal-cache.js";
import { getJourneyKey } from "../model/gtfs.js";
import type { JourneyCall } from "../model/journey.js";
import type { Source } from "../model/source.js";
import type { Trip } from "../model/trip.js";
import { formatCallTime } from "../utils/format-call-time.js";

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
	networkRef: string,
	areaId: string,
	at: Temporal.Instant,
	{ limit = DEFAULT_LIMIT, horizonMs = DEFAULT_HORIZON_MS, stopRef: onlyStopRef }: ComputeStopDeparturesOptions = {},
): StopDeparture[] {
	const gtfs = source.gtfs;
	if (gtfs === undefined) return [];

	// Station du GTFS statique, ou arrêt créé à la volée par le flux temps réel.
	const stopArea = gtfs.stopAreas.get(areaId) ?? source.realtimeStopAreas.get(areaId);
	if (stopArea === undefined) return [];

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
	})[] = [];

	const stopRefOf = (stopId: string) => `${networkRef}:StopPoint:${source.options.mapStopRef?.(stopId) ?? stopId}`;

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
			const stopRef = stopRefOf(stop.id);
			if (onlyStopRef !== undefined && stopRef !== onlyStopRef) continue;

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

			const expectedMs = call?.expectedDepartureTime;
			const effectiveMs = expectedMs ?? aimedMs;
			if (effectiveMs < nowMs || effectiveMs > untilMs) continue;

			emittedCalls.add(`${journeyKey}|${stop.id}`);
			departures.push({
				sortKey: effectiveMs,
				stopRef,
				stopName: stop.name,
				platformName: call?.platform ?? stop.platformCode,
				lineRef: `${networkRef}:Line:${source.options.mapLineRef?.(trip.route.id) ?? trip.route.id}`,
				// Résolue après tri et troncature : `getDestination` peut matérialiser les arrêts de la
				// course, inutile de le faire pour des passages qui ne seront pas rendus.
				resolveDestination: () =>
					source.options.getDestination?.(
						journey ?? trip.getScheduledJourney(date, true),
						journey?.vehicleDescriptor,
					) ?? resolveDestination(trip, stopTimeIdx, call),
				aimedTime: formatCallTime(aimedMs, stop.timeZone, timeZone),
				expectedTime: expectedMs !== undefined ? formatCallTime(expectedMs, stop.timeZone, timeZone) : undefined,
				callStatus: call?.status ?? "SCHEDULED",
				// Les identifiants publiés remplacent leurs barres obliques côté serveur : la valeur
				// rendue ici doit pouvoir être comparée telle quelle à celles du store des courses.
				journeyId: journey?.lastPublishedKey?.replaceAll("/", "_"),
				journeyRef: `${networkRef}:ServiceJourney:${source.options.mapTripRef?.(trip.id) ?? trip.id}`,
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

		for (const [index, call] of calls.entries()) {
			if (!areaStopIds.has(call.stop.id)) continue;
			// Ni le terminus, ni un arrêt interdit à la montée, ni une desserte déjà rendue par l'index.
			if (index === calls.length - 1 || call.flags.includes("NO_PICKUP")) continue;
			if (emittedCalls.has(`${journeyKey}|${call.stop.id}`)) continue;

			const stopRef = stopRefOf(call.stop.id);
			if (onlyStopRef !== undefined && stopRef !== onlyStopRef) continue;

			const effectiveMs = call.expectedDepartureTime ?? call.aimedDepartureTime;
			if (effectiveMs < nowMs || effectiveMs > untilMs) continue;

			departures.push({
				sortKey: effectiveMs,
				stopRef,
				stopName: call.stop.name,
				platformName: call.platform ?? call.stop.platformCode,
				lineRef: `${networkRef}:Line:${source.options.mapLineRef?.(trip.route.id) ?? trip.route.id}`,
				resolveDestination: () =>
					source.options.getDestination?.(journey, journey.vehicleDescriptor) ??
					call.headsign ??
					trip.headsign ??
					calls.findLast((candidate) => candidate.status !== "SKIPPED")?.stop.name,
				aimedTime: formatCallTime(call.aimedDepartureTime, call.stop.timeZone, timeZone),
				expectedTime:
					call.expectedDepartureTime !== undefined
						? formatCallTime(call.expectedDepartureTime, call.stop.timeZone, timeZone)
						: undefined,
				callStatus: call.status,
				journeyId: journey.lastPublishedKey?.replaceAll("/", "_"),
				journeyRef: `${networkRef}:ServiceJourney:${source.options.mapTripRef?.(trip.id) ?? trip.id}`,
				serviceDate: date.toString(),
			});
		}
	}

	departures.sort((a, b) => a.sortKey - b.sortKey);

	return departures
		.slice(0, limit)
		.map(({ sortKey, resolveDestination, ...departure }) => ({ ...departure, destination: resolveDestination() }));
}

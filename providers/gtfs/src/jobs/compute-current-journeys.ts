import type { LinePath, VehicleJourney, VehicleJourneyPath } from "@bus-tracker/contracts";
import { match, P } from "ts-pattern";
import { createPlainDate, createPlainTime, createZonedDateTime } from "../cache/temporal-cache.js";
import { downloadGtfsRt } from "../download/download-gtfs-rt.js";
import { type Gtfs, getJourneyKey } from "../model/gtfs.js";
import type { TripDescriptor, TripUpdate, VehiclePosition } from "../model/gtfs-rt.js";
import type { Journey, JourneyCall } from "../model/journey.js";
import { type RealtimeResources, resolveShape } from "../model/realtime-lookup.js";
import type { Shape } from "../model/shape.js";
import { DEFAULT_TRIP_UPDATE_TTL_MS, type Source, type SourceOptions } from "../model/source.js";
import { StopArea } from "../model/stop-area.js";
import { fastFormatISO, formatCallTime, getTimeZoneOffsetMs } from "../utils/format-call-time.js";
import { guessStartDate } from "../utils/guess-start-date.js";
import { padSourceId } from "../utils/pad-source-id.js";
import { scatterOverlappingPositions } from "../utils/scatter-overlapping-positions.js";
import { stackStoppedPositions } from "../utils/stack-stopped-positions.js";
import { createStopWatch } from "../utils/stop-watch.js";
import {
	createCallsFromTripUpdate,
	findAddedTripShapeMatchWithFallback,
	guessPositionFromCalls,
	type TripShapeMatchCandidate,
} from "./added-trip-shape-matching.js";
import { indexTripModifications } from "./apply-trip-modifications.js";

/**
 * Durée pendant laquelle une course ayant reçu une position GPS est considérée comme encore suivie
 * en GPS en aval. Calquée sur la rétention des positions GPS du store serveur.
 */
const VEHICLE_POSITION_RETENTION_MS = 10 * 60 * 1000;

/**
 * Projette un arrêt interne sur le contrat publié.
 *
 * `aimedTime`/`expectedTime` portent l'heure de *départ* — sauf au terminus, qui n'a pas de départ
 * et expose donc son arrivée. Les heures d'arrivée ne sont publiées séparément que lorsqu'elles
 * diffèrent du départ, c'est-à-dire quand le véhicule stationne à l'arrêt : le client peut alors
 * afficher « arrivée → départ ».
 */
function serializeCall(
	call: JourneyCall,
	isLast: boolean,
	source: Source,
	networkRef: string,
	timeZone: string,
): NonNullable<VehicleJourney["calls"]>[number] {
	const aimedTimeMs = isLast ? call.aimedArrivalTime : call.aimedDepartureTime;
	const expectedTimeMs = isLast ? call.expectedArrivalTime : call.expectedDepartureTime;

	// Au terminus l'arrivée *est* déjà l'heure publiée : la republier serait redondant.
	const hasDwellTime =
		!isLast &&
		(call.aimedArrivalTime !== call.aimedDepartureTime || call.expectedArrivalTime !== call.expectedDepartureTime);

	return {
		aimedTime: formatCallTime(aimedTimeMs, call.stop.timeZone, timeZone),
		expectedTime:
			expectedTimeMs !== undefined ? formatCallTime(expectedTimeMs, call.stop.timeZone, timeZone) : undefined,
		aimedArrivalTime: hasDwellTime ? formatCallTime(call.aimedArrivalTime, call.stop.timeZone, timeZone) : undefined,
		expectedArrivalTime:
			hasDwellTime && call.expectedArrivalTime !== undefined
				? formatCallTime(call.expectedArrivalTime, call.stop.timeZone, timeZone)
				: undefined,
		stopRef: `${networkRef}:StopPoint:${source.options.mapStopRef?.(call.stop.id) ?? call.stop.id}`,
		stopName: call.stop.name,
		stopOrder: call.sequence,
		distanceTraveled: call.distanceTraveled,
		latitude: call.stop.latitude,
		longitude: call.stop.longitude,
		platformName: call.platform,
		callStatus: call.status,
		flags: call.flags,
	};
}

const getCalls = (
	journey: Journey,
	at: Temporal.Instant,
	getAheadTime?: (journey: Journey) => number,
	/** Fenêtre pendant laquelle une course dont le terminus vient d'être franchi reste publiable. */
	graceMs = 0,
) => {
	const aheadTime = getAheadTime?.(journey) ?? 0;
	const atMs = at.epochMilliseconds;

	// Rejet rapide via les bornes précalculées, sans matérialiser le tableau calls.
	if (atMs + aheadTime * 1000 < journey.firstCallArrivalMs) return;
	if (atMs - graceMs > journey.lastCallDepartureMs) return;

	// Le voyage est dans la fenêtre : on accède aux calls (matérialisation si nécessaire).
	const firstCall = journey.calls[0];
	if (
		firstCall === undefined ||
		atMs + aheadTime * 1000 < (firstCall.expectedArrivalTime ?? firstCall.aimedArrivalTime)
	)
		return;

	const lastCall = journey.calls[journey.calls.length - 1];
	if (lastCall === undefined || atMs - graceMs > (lastCall.expectedDepartureTime ?? lastCall.aimedDepartureTime))
		return;

	const getCallTime = (call: JourneyCall, index: number) =>
		index === journey.calls.length - 1
			? (call.expectedArrivalTime ?? call.aimedArrivalTime)
			: (call.expectedDepartureTime ?? call.aimedDepartureTime);

	// Chercher le dernier arrêt déjà desservi (heure <= maintenant).
	// Un arrêt ultérieur desservi en temps réel implique que tous les arrêts précédents l'ont été aussi,
	// même si leur heure théorique est encore dans le futur.
	const lastPassedIndex = journey.calls.findLastIndex((call, index) => atMs >= getCallTime(call, index));

	const firstCandidateIndex = lastPassedIndex + 1;
	if (firstCandidateIndex >= journey.calls.length) {
		// Tous les arrêts sont desservis : le terminus est atteint. La course est publiée une
		// dernière fois — guessPosition ancre alors sa position au terminus — si l'arrivée a eu lieu
		// depuis le dernier cycle, sans quoi elle disparaîtrait de la carte avant d'y être arrivée.
		// Le test est strict : au cycle suivant `atMs - graceMs` a dépassé l'arrivée, donc une seule
		// publication de grâce a lieu.
		if (atMs - graceMs >= (lastCall.expectedArrivalTime ?? lastCall.aimedArrivalTime)) return;
		return [lastCall];
	}

	// Parmi les arrêts restants, le monitoredCall est celui dont l'heure est la plus petite.
	// Cela gère le cas d'une course en avance où un arrêt tardif (temps réel) a une heure
	// antérieure à l'heure théorique d'un arrêt précédent : afficher l'arrêt 2 à 13:12 puis
	// l'arrêt 3 à 13:11 serait incohérent, donc on commence directement à l'arrêt 3.
	let monitoredCallIndex = firstCandidateIndex;
	let minCallTime = getCallTime(journey.calls[firstCandidateIndex]!, firstCandidateIndex);
	for (let i = firstCandidateIndex + 1; i < journey.calls.length; i++) {
		const t = getCallTime(journey.calls[i]!, i);
		if (t < minCallTime) {
			minCallTime = t;
			monitoredCallIndex = i;
		}
	}

	return journey.calls.slice(monitoredCallIndex);
};

/**
 * Arrêts restant à desservir d'après la position remontée par le flux.
 *
 * Un producteur qui décrit une course déviée sans passer par `modified_trip` numérote encore ses
 * arrêts comme le GTFS statique : la séquence qu'il remonte ne désigne plus le même arrêt une fois
 * la course renumérotée, et la desserte publiée reculerait d'autant d'arrêts que la déviation en a
 * inséré avant la position du véhicule. Seul l'identifiant d'arrêt reste fiable dans ce cas.
 *
 * Une position qui ne désigne aucun arrêt de la course retombe sur la déduction par les horaires,
 * plutôt que de tronquer la desserte au mauvais endroit.
 */
const getCallsFromVehiclePosition = (journey: Journey, vehiclePosition: VehiclePosition, at: Temporal.Instant) => {
	const useStopId = journey.hasModifications() && vehiclePosition.trip?.modifiedTrip === undefined;

	const index =
		!useStopId && vehiclePosition.currentStopSequence !== undefined
			? journey.calls.findIndex((call) => call.sequence >= vehiclePosition.currentStopSequence!)
			: vehiclePosition.stopId !== undefined
				? journey.calls.findIndex((call) => call.stop.id === vehiclePosition.stopId)
				: -1;

	return index !== -1 ? journey.calls.slice(index) : getCalls(journey, at, () => Number.POSITIVE_INFINITY);
};

/**
 * Courses supplémentaires. `ADDED` est déprécié au profit de `NEW`, qui seul garantit un parcours
 * complet : les deux restent traités, mais pas avec la même confiance (voir la collecte plus bas).
 */
const isAddedTrip = (tripDescriptor: TripDescriptor) =>
	tripDescriptor.scheduleRelationship === "ADDED" || tripDescriptor.scheduleRelationship === "NEW";

/** `DELETED` est un `CANCELED` que le producteur demande de ne pas montrer : ne rien publier suffit. */
const isCanceledTrip = (tripDescriptor: TripDescriptor) =>
	tripDescriptor.scheduleRelationship === "CANCELED" || tripDescriptor.scheduleRelationship === "DELETED";

const getTripFromDescriptor = (gtfs: Gtfs, tripDescriptor: TripDescriptor, allowTripGuessing?: boolean) => {
	// Course déviée : le descripteur a tous ses autres champs vides (spec), la course d'origine est
	// désignée par la modification elle-même.
	if (tripDescriptor.modifiedTrip !== undefined) {
		return gtfs.trips.get(tripDescriptor.modifiedTrip.affectedTripId);
	}

	if (tripDescriptor.tripId === undefined) return;

	const trip = gtfs.trips.get(tripDescriptor.tripId);
	if (trip !== undefined) {
		if (tripDescriptor.routeId !== undefined && trip.route.id !== tripDescriptor.routeId) return;
		if (tripDescriptor.directionId !== undefined && trip.direction !== tripDescriptor.directionId) return;
		return trip;
	}

	if (
		allowTripGuessing &&
		tripDescriptor.routeId !== undefined &&
		tripDescriptor.startDate !== undefined &&
		tripDescriptor.startTime !== undefined &&
		gtfs.routes.has(tripDescriptor.routeId)
	) {
		const startDate = createPlainDate(tripDescriptor.startDate);

		const [hours, minutes, seconds] = tripDescriptor.startTime.split(":").map(Number);
		const startTimeModulus = Math.floor((hours ?? 0) / 24);
		const startTime = createPlainTime(
			`${String((hours ?? 0) % 24).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
		);

		const startsAt = createZonedDateTime(
			startDate.add({ days: startTimeModulus }),
			startTime,
			gtfs.routes.get(tripDescriptor.routeId)!.agency.timeZone,
		);

		if (startsAt.toInstant().since(Temporal.Now.instant()).total("minutes") >= 30) {
			return;
		}

		const matchingTrip = gtfs.trips.values().find((trip) => {
			if (trip.route.id !== tripDescriptor.routeId) return false;
			if (trip.direction !== (tripDescriptor.directionId ?? 0)) return false;
			if (!trip.service.runsOn(startDate)) return false;

			if (trip.stopTimeCount === 0) return false;

			const secs = trip.firstArrivalSecs;
			const totalH = Math.floor(secs / 3600);
			const m = Math.floor((secs % 3600) / 60);
			const s = secs % 60;
			const startTime = `${totalH.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
			return startTime === tripDescriptor.startTime;
		});

		return matchingTrip;
	}

	return trip;
};

const getStartDateFromTripDescriptor = (
	trip: NonNullable<ReturnType<typeof getTripFromDescriptor>>,
	tripDescriptor: TripDescriptor,
	updatedAt: Temporal.Instant,
) => {
	const startDate = tripDescriptor.modifiedTrip?.startDate ?? tripDescriptor.startDate;
	return startDate !== undefined
		? Temporal.PlainDate.from(startDate)
		: guessStartDate(trip.firstArrivalSecs, updatedAt.toZonedDateTimeISO(trip.route.agency.timeZone));
};

const getAddedTripStartDate = (gtfs: Gtfs, tripUpdate: TripUpdate, calls: JourneyCall[]) => {
	const declaredStartDate = tripUpdate.tripProperties?.startDate ?? tripUpdate.trip.startDate;
	if (declaredStartDate !== undefined) return Temporal.PlainDate.from(declaredStartDate);
	if (tripUpdate.trip.routeId === undefined) return;

	const route = gtfs.routes.get(tripUpdate.trip.routeId);
	const firstCall = calls[0];
	if (route === undefined || firstCall === undefined) return;

	return Temporal.Instant.fromEpochMilliseconds(firstCall.aimedArrivalTime)
		.toZonedDateTimeISO(route.agency.timeZone)
		.toPlainDate();
};

const getActiveAddedCalls = (calls: JourneyCall[], at: Temporal.Instant, aheadTime = 0) => {
	const atMs = at.epochMilliseconds;
	const firstCall = calls[0];
	const lastCall = calls[calls.length - 1];
	if (firstCall === undefined || lastCall === undefined) return;
	if (atMs + aheadTime * 1000 < firstCall.aimedArrivalTime) return;
	if (atMs > lastCall.aimedDepartureTime) return;

	const lastPassedIndex = calls.findLastIndex((call, index) => {
		const callTime = index === calls.length - 1 ? call.aimedArrivalTime : call.aimedDepartureTime;
		return atMs >= callTime;
	});

	return calls.slice(Math.min(lastPassedIndex + 1, calls.length - 1));
};

const getPositionFromLastPassedAddedCall = (calls: JourneyCall[], at: Temporal.Instant, timeZone: string) => {
	const atMs = at.epochMilliseconds;
	const lastPassedIndex = calls.findLastIndex((call, index) => {
		const callTime = index === calls.length - 1 ? call.aimedArrivalTime : call.aimedDepartureTime;
		return atMs >= callTime;
	});
	const call = calls[Math.max(0, lastPassedIndex)];
	if (call === undefined) return;

	return {
		latitude: call.stop.latitude,
		longitude: call.stop.longitude,
		atStop: true,
		type: "COMPUTED" as const,
		recordedAt: at.toZonedDateTimeISO(call.stop.timeZone ?? timeZone).toString({ timeZoneName: "never" }),
	};
};

const getScheduledTripShapeCandidates = (
	gtfs: Gtfs,
	tripUpdate: TripUpdate,
	addedCalls: JourneyCall[],
	startDate: Temporal.PlainDate,
) => {
	const routeId = tripUpdate.trip.routeId;
	if (routeId === undefined || addedCalls.length === 0) return [];

	const candidates: TripShapeMatchCandidate[] = [];

	for (const trip of gtfs.trips.values()) {
		if (trip.route.id !== routeId) continue;
		if (trip.shape === undefined) continue;

		const journey = trip.getScheduledJourney(startDate);
		if (journey === undefined) continue;

		candidates.push({
			date: startDate,
			trip,
			calls: journey.calls,
		});
	}

	return candidates;
};

/**
 * Rassemble ce qu'il faut pour publier une course que le GTFS statique ne connaît pas.
 *
 * Le tracé est cherché dans cet ordre : celui que le producteur déclare, puis celui d'une course
 * théorique de la même ligne dont la desserte coïncide. Sans tracé, seules les courses `NEW` sont
 * retenues d'office : la spec leur impose de décrire leur parcours complet, ce qu'elle ne garantit
 * pas des courses `ADDED`, dépréciées, qu'une source doit donc explicitement réclamer.
 */
function collectAddedTrip(
	gtfs: Gtfs,
	options: SourceOptions,
	tripUpdate: TripUpdate,
	resources: RealtimeResources,
	canceledTripCandidates: TripShapeMatchCandidate[],
	addedTrips: AddedTripPublication[],
) {
	const calls = createCallsFromTripUpdate(gtfs, tripUpdate, resources);
	// Un arrêt unique ne décrit aucun trajet : même exigence que pour une course théorique.
	if (calls === undefined || calls.length < 2) return;

	const startDate = getAddedTripStartDate(gtfs, tripUpdate, calls);
	if (startDate === undefined) return;

	const declaredShape = resolveShape(gtfs, resources, tripUpdate.tripProperties?.shapeId);
	if (declaredShape !== undefined) {
		const distances = declaredShape.projectStopsInOrder(calls.map((call) => call.stop));
		for (let index = 0; index < calls.length; index++) {
			calls[index]!.distanceTraveled = distances[index];
		}
		addedTrips.push({ tripUpdate, calls, startDate, shape: declaredShape });
		return;
	}

	if (options.addedTripShapeMatching === true) {
		const match = findAddedTripShapeMatchWithFallback(
			tripUpdate,
			calls,
			startDate,
			canceledTripCandidates,
			getScheduledTripShapeCandidates(gtfs, tripUpdate, calls, startDate),
		);

		if (match !== undefined) {
			addedTrips.push({
				tripUpdate,
				calls: match.calls,
				startDate,
				shape: match.candidate.trip.shape,
				candidate: match.candidate,
			});
			return;
		}
	}

	if (tripUpdate.trip.scheduleRelationship === "NEW" || options.addedTripShapeMatching === true) {
		addedTrips.push({ tripUpdate, calls, startDate });
	}
}

// const matchJourneyToTripDescriptor = (journey: Journey, tripDescriptor: TripDescriptor) => {
// 	if (journey.trip.id !== tripDescriptor.tripId) return false;
// 	if (tripDescriptor.routeId !== undefined && journey.trip.route.id !== tripDescriptor.routeId) return false;
// 	if (tripDescriptor.directionId !== undefined && journey.trip.direction !== tripDescriptor.directionId) return false;
// 	if (tripDescriptor.startDate !== undefined && !journey.date.equals(tripDescriptor.startDate)) return false;
// 	return true;
// };

function getCurrentCallHeadsign(calls: JourneyCall[], at: Temporal.Instant): string | undefined {
	let headsign: string | undefined;
	const nowMs = at.epochMilliseconds;

	for (const call of calls) {
		if (call.status === "SKIPPED") continue;

		const departureTime = call.expectedDepartureTime ?? call.aimedDepartureTime;

		if (departureTime > nowMs) break;

		if (call.headsign) {
			headsign = call.headsign;
		}
	}

	return headsign;
}

function getCurrentStopHeadsign(journey: Journey, at: Temporal.Instant): string | undefined {
	return getCurrentCallHeadsign(journey.calls, at);
}

/**
 * Enregistre, si la course est déviée, les portions de tracé qu'elle n'emprunte plus, et retourne
 * la référence sous laquelle le client les récupérera.
 *
 * Une même déviation engendre un tracé abandonné différent pour chacune des courses qu'elle vise :
 * la référence porte donc la course et sa date de service. Son contenu est réécrit à chaque cycle,
 * ce qui suffit à en propager les révisions successives.
 */
function resolveCancelledPathRef(
	journey: Journey | undefined,
	source: Source,
	networkRef: string,
	paths: Map<string, VehicleJourneyPath | LinePath>,
) {
	if (journey === undefined || source.options.disableRoutePaths) return undefined;

	const cancelledPath = journey.cancelledPath;
	if (cancelledPath === undefined) return undefined;

	const ref = `${networkRef}:CancelledPath:${source.id}:${journey.trip.id}:${journey.date.toString()}`;
	paths.set(ref, cancelledPath);
	return ref;
}

/** Une course supplémentaire en attente de publication, une fois son tracé résolu (ou non). */
type AddedTripPublication = {
	tripUpdate: TripUpdate;
	calls: JourneyCall[];
	startDate: Temporal.PlainDate;
	/** Tracé suivi : déclaré par le flux, ou emprunté à la course théorique appariée. */
	shape?: Shape;
	/** Course théorique appariée, dont la course supplémentaire emprunte ligne et libellés. */
	candidate?: TripShapeMatchCandidate;
};

/** Résultat d'un cycle de calcul : les courses à publier et les tracés auxquels elles renvoient. */
type ComputeResult = {
	journeys: VehicleJourney[];
	paths: Record<string, VehicleJourneyPath | LinePath>;
};

export async function computeVehicleJourneys(source: Source): Promise<ComputeResult> {
	if (source.gtfs === undefined) return { journeys: [], paths: {} };

	const now = Temporal.Now.instant();
	const nowMs = now.epochMilliseconds;
	const watch = createStopWatch();
	const sourceId = padSourceId(source);
	const updateLog = console.draft("%s     ► Generating active journeys list.", sourceId);

	try {
		updateLog("%s 1/2 ► Downloading real-time data from feeds.", sourceId);
		const { tripUpdates, vehiclePositions, tripModifications, resources, failedFeedCount } =
			await downloadGtfsRt(source);
		const downloadTime = watch.step();

		updateLog("%s 2/2 ► Computing active journeys.", sourceId);
		const activeJourneys = new Map<string, VehicleJourney>();
		const paths = new Map<string, VehicleJourneyPath | LinePath>();
		// Tracé sur lequel chaque position calculée a été placée, pour la mise en file des véhicules à l'arrêt.
		const positionShapes = new WeakMap<VehicleJourney, Shape>();
		const handledJourneyIds = new Set<string>();
		const handledBlockIds = new Set<string>();
		const canceledJourneyIds = new Set<string>();
		const canceledTripCandidates: TripShapeMatchCandidate[] = [];
		const addedTrips: AddedTripPublication[] = [];
		const tripUpdateTtlMs = source.options.tripUpdateTtlMs ?? DEFAULT_TRIP_UPDATE_TTL_MS;

		// Les déviations sont appliquées avant tout : elles redéfinissent la desserte de la course, à
		// laquelle les TripUpdate viendront ensuite rattacher leurs horaires.
		if (tripModifications.length > 0) {
			for (const [journeyKey, plan] of indexTripModifications(source.gtfs, tripModifications, resources)) {
				const trip = source.gtfs.trips.get(plan.tripId);
				if (trip === undefined) continue;

				let journey = source.gtfs.journeys.get(journeyKey);
				if (journey === undefined) {
					journey = trip.getScheduledJourney(plan.date, true);
					source.gtfs.journeys.set(journeyKey, journey);
				}

				journey.applyModifications(plan, nowMs);
				source.modifiedJourneyKeys.add(journeyKey);
			}
		}

		// Une déviation disparue du flux a été levée : la desserte théorique reprend ses droits, au
		// même délai de tolérance que les TripUpdate et sous la même réserve d'un cycle complet.
		if (failedFeedCount === 0) {
			for (const journeyKey of source.modifiedJourneyKeys) {
				const journey = source.gtfs.journeys.get(journeyKey);

				// Course balayée entre-temps : sa déviation a disparu avec elle.
				if (journey === undefined) {
					source.modifiedJourneyKeys.delete(journeyKey);
					continue;
				}

				if (journey.lastModificationAtMs === undefined) {
					source.modifiedJourneyKeys.delete(journeyKey);
					continue;
				}

				if (nowMs - journey.lastModificationAtMs <= tripUpdateTtlMs) continue;

				journey.clearModifications();
				source.modifiedJourneyKeys.delete(journeyKey);
			}
		}

		source.realtimeStopAreas = collectRealtimeStopAreas(source);

		if (tripUpdates.length > 0) {
			for (const tripUpdate of tripUpdates) {
				const updatedAt = Temporal.Instant.fromEpochMilliseconds(tripUpdate.timestamp * 1000);

				const trip = getTripFromDescriptor(source.gtfs, tripUpdate.trip, source.options.allowTripGuessing);
				if (trip === undefined) continue;

				const startDate = getStartDateFromTripDescriptor(trip, tripUpdate.trip, updatedAt);

				if (isCanceledTrip(tripUpdate.trip)) {
					canceledJourneyIds.add(`${trip.id}:${startDate}`);
					if (source.options.addedTripShapeMatching === true && trip.shape !== undefined) {
						canceledTripCandidates.push({
							date: startDate,
							trip,
							calls: trip.getScheduledJourney(startDate, true).calls,
						});
					}
				}
			}

			for (const tripUpdate of tripUpdates) {
				const updatedAt = Temporal.Instant.fromEpochMilliseconds(tripUpdate.timestamp * 1000);

				const trip = getTripFromDescriptor(source.gtfs, tripUpdate.trip, source.options.allowTripGuessing);
				if (trip === undefined) {
					if (isAddedTrip(tripUpdate.trip)) {
						collectAddedTrip(source.gtfs, source.options, tripUpdate, resources, canceledTripCandidates, addedTrips);
					}
					continue;
				}

				if (isCanceledTrip(tripUpdate.trip)) {
					continue;
				}

				if (trip.stopTimeCount < 2) continue;
				const startDate = getStartDateFromTripDescriptor(trip, tripUpdate.trip, updatedAt);
				if (canceledJourneyIds.has(`${trip.id}:${startDate}`)) continue;

				let journey = source.gtfs.journeys.get(getJourneyKey(startDate, trip.id));
				if (journey === undefined) {
					journey = trip.getScheduledJourney(startDate, true);
					source.gtfs.journeys.set(getJourneyKey(startDate, trip.id), journey);
				}
				// Un producteur qui décrit une course déviée sans passer par `modified_trip` numérote
				// encore ses arrêts comme le GTFS statique : seul l'identifiant d'arrêt reste fiable.
				journey.updateJourney(
					source.gtfs,
					tripUpdate.stopTimeUpdate ?? [],
					source.options.appendTripUpdateInformation,
					journey.hasModifications() && tripUpdate.trip.modifiedTrip === undefined,
				);
				journey.setVehicleDescriptor(tripUpdate.vehicle, tripUpdate.timestamp * 1000);
				journey.lastTripUpdateAtMs = nowMs;
			}

			// source.gtfs.journeys.sort((a, b) => {
			// 	const aStart = a.calls.at(0)!.expectedArrivalTime ?? a.calls.at(0)!.aimedArrivalTime;
			// 	const bStart = b.calls.at(0)!.expectedArrivalTime ?? b.calls.at(0)!.aimedArrivalTime;
			// 	return aStart - bStart;
			// });
		}

		// Un flux GTFS-RT est un instantané complet : une course qui en a disparu n'a plus
		// d'information temps réel. Sans cette expiration, ses arrêts supprimés le resteraient
		// jusqu'à la fin de la course, faute d'un updateJourney pour les rétablir — c'est le seul
		// recours quand le flux ne porte aucun horaire temps réel. Appliquée avant la publication
		// pour que le rétablissement prenne effet dès ce cycle. Les cycles où un flux n'a pas
		// répondu sont ignorés : l'absence d'une course n'y prouve rien.
		if (failedFeedCount === 0) {
			for (const journey of source.gtfs.journeys.values()) {
				journey.expireStaleRealtime(nowMs, tripUpdateTtlMs);
			}
		}

		const maxVehiclePositionAgeMs = source.options.maxVehiclePositionAgeMs;

		for (const vehiclePosition of vehiclePositions) {
			// 👏 https://transport.data.gouv.fr/resources/81925
			if (vehiclePosition.position === undefined) continue;

			// Position figée : le terminal embarqué a cessé d'émettre alors que la course reste ouverte
			// dans le flux. Un timestamp nul signale un producteur qui n'en fournit aucun (même pas dans
			// l'en-tête du flux) : rien ne permet alors de juger de la fraîcheur.
			const isStalePosition =
				maxVehiclePositionAgeMs !== undefined &&
				vehiclePosition.timestamp > 0 &&
				nowMs - vehiclePosition.timestamp * 1000 >= maxVehiclePositionAgeMs;

			// nomad-car-geo3d patch
			if (source.id === "nomad-car-geo3d") {
				const tripUpdate =
					vehiclePosition.trip?.tripId !== undefined
						? tripUpdates.find((tripUpdate) => tripUpdate.trip.tripId === vehiclePosition.trip!.tripId)
						: undefined;
				if (tripUpdate !== undefined) {
					const nextStop = tripUpdate.stopTimeUpdate?.find(
						(stopTimeUpdate) =>
							stopTimeUpdate.scheduleRelationship === "SCHEDULED" && stopTimeUpdate.departure === undefined,
					);
					if (nextStop !== undefined) {
						vehiclePosition.currentStatus = "IN_TRANSIT_TO";
						vehiclePosition.currentStopSequence = nextStop.stopSequence;
						vehiclePosition.stopId = nextStop.stopId;
					}
				}
			}

			let journey: Journey | undefined;

			const updatedAt = Temporal.Instant.fromEpochMilliseconds(vehiclePosition.timestamp * 1000);

			if (vehiclePosition.trip !== undefined) {
				const trip = getTripFromDescriptor(source.gtfs, vehiclePosition.trip, source.options.allowTripGuessing);
				if (trip !== undefined) {
					const startDate =
						vehiclePosition.trip.startDate !== undefined
							? Temporal.PlainDate.from(vehiclePosition.trip.startDate)
							: trip.stopTimeCount > 0
								? guessStartDate(trip.firstArrivalSecs, updatedAt.toZonedDateTimeISO(trip.route.agency.timeZone))
								: Temporal.Now.plainDateISO();

					if (canceledJourneyIds.has(`${trip.id}:${startDate}`)) continue;

					journey = source.gtfs.journeys.get(getJourneyKey(startDate, trip.id));
					if (journey === undefined) {
						journey = trip.getScheduledJourney(startDate, true);
						source.gtfs.journeys.set(getJourneyKey(startDate, trip.id), journey);
					}

					// La course n'est pas marquée comme suivie : elle retombe sur son traitement plus bas —
					// ou disparaît si la source ne le publie pas (`mode: "VP-ONLY"`, `excludeScheduled`).
					// Son temps réel part avec la position : le TripUpdate qui continue de dériver derrière
					// un terminal muet ne décrit plus la course, l'horaire théorique reprend la main.
					if (isStalePosition) {
						journey.dropRealtime();
						continue;
					}

					const minutesSinceUpdate = (now.epochMilliseconds - updatedAt.epochMilliseconds) / 60000;
					if (minutesSinceUpdate >= 10) {
						const lastCall = journey.calls[journey.calls.length - 1]!;
						if (now.epochMilliseconds > (lastCall.expectedDepartureTime ?? lastCall.aimedDepartureTime)) {
							continue;
						}
					}
					handledJourneyIds.add(journey.id);
					journey.lastVehiclePositionAtMs = nowMs;
					if (journey.trip.block !== undefined) {
						handledBlockIds.add(journey.trip.block);
					}
				}
			}

			// Un véhicule sans course rattachée n'a rien qui prenne le relais : sa position figée est
			// simplement écartée.
			if (
				journey === undefined &&
				(isStalePosition || (now.epochMilliseconds - updatedAt.epochMilliseconds) / 60000 >= 5)
			)
				continue;

			const networkRef = source.options.getNetworkRef(journey, vehiclePosition.vehicle);
			const operatorRef = source.options.getOperatorRef?.(journey, vehiclePosition.vehicle);
			const vehicleRef =
				source.options.getVehicleRef !== undefined
					? source.options.getVehicleRef?.(vehiclePosition.vehicle, journey)
					: (vehiclePosition.vehicle.label ?? vehiclePosition.vehicle.id);

			const tripRef =
				journey !== undefined ? (source.options.mapTripRef?.(journey.trip.id) ?? journey.trip.id) : undefined;

			const calls =
				journey !== undefined
					? getCallsFromVehiclePosition(journey, vehiclePosition, now)
					: vehiclePosition.trip?.tripId !== undefined
						? createCallsFromTripUpdate(
								source.gtfs,
								tripUpdates.find(
									(tripUpdate) =>
										tripUpdate.trip.tripId === vehiclePosition.trip!.tripId && !isCanceledTrip(tripUpdate.trip),
								),
								resources,
							)?.filter(({ aimedDepartureTime }) => now.epochMilliseconds < aimedDepartureTime)
						: undefined;

			const key = `${networkRef}:${operatorRef ?? ""}:VehicleTracking:${vehiclePosition.vehicle.id}`;

			const pathRef =
				!source.options.disableRoutePaths && journey?.shape !== undefined
					? `${networkRef}:RoutePath:${source.id}:${journey.shape.id}`
					: undefined;

			if (pathRef !== undefined && !paths.has(pathRef)) {
				paths.set(pathRef, journey!.shape!.asPath());
			}

			const cancelledPathRef = resolveCancelledPathRef(journey, source, networkRef, paths);

			const timeZone = journey?.trip.route.agency.timeZone ?? "Europe/Paris";
			const offsetMs = getTimeZoneOffsetMs(timeZone, now.epochMilliseconds);

			const vehicleJourney: VehicleJourney = {
				id: key,
				line:
					journey !== undefined
						? {
								ref: `${networkRef}:Line:${
									source.options.mapLineRef?.(journey.trip.route.id) ?? journey.trip.route.id
								}`,
								number: journey.trip.route.name,
								type: journey.trip.route.type,
								color: journey.trip.route.color,
								textColor: journey.trip.route.textColor,
							}
						: vehiclePosition.trip?.routeId !== undefined
							? {
									ref: `${networkRef}:Line:${
										source.options.mapLineRef?.(vehiclePosition.trip.routeId) ?? vehiclePosition.trip.routeId
									}`,
									number: vehiclePosition.trip.routeId,
									type: "UNKNOWN",
								}
							: undefined,
				direction: (journey?.trip.direction ?? vehiclePosition.trip?.directionId) === 0 ? "OUTBOUND" : "INBOUND",
				calls:
					journey !== undefined || calls !== undefined
						? (calls?.map((call, index) =>
								serializeCall(call, index === calls.length - 1, source, networkRef, timeZone),
							) ?? [])
						: undefined,
				destination:
					source.options.getDestination?.(journey, vehiclePosition.vehicle) ??
					(journey !== undefined ? getCurrentStopHeadsign(journey, now) : undefined) ??
					journey?.trip.headsign,
				missionCode: source.options.getMissionCode?.(journey, vehiclePosition.vehicle) ?? undefined,
				position: {
					latitude: vehiclePosition.position.latitude,
					longitude: vehiclePosition.position.longitude,
					bearing: vehiclePosition.position.bearing,
					atStop: vehiclePosition.currentStatus === "STOPPED_AT",
					type: "GPS",
					recordedAt: fastFormatISO(vehiclePosition.timestamp * 1000, offsetMs),
				},
				pathRef,
				cancelledPathRef,
				// Aucune course théorique appariée : les arrêts, s'il y en a, viennent du TripUpdate seul.
				isAdded: journey === undefined ? true : undefined,
				occupancy: match(vehiclePosition.occupancyStatus)
					.with(P.union("EMPTY", "MANY_SEATS_AVAILABLE"), () => "LOW" as const)
					.with(P.union("FEW_SEATS_AVAILABLE", "STANDING_ROOM_ONLY"), () => "MEDIUM" as const)
					.with(P.union("CRUSHED_STANDING_ROOM_ONLY", "FULL"), () => "HIGH" as const)
					.with(P.union("NOT_ACCEPTING_PASSENGERS", "NOT_BOARDABLE" as const), () => "NO_PASSENGERS" as const)
					.otherwise(() => undefined),
				journeyRef: journey !== undefined ? `${networkRef}:ServiceJourney:${tripRef}` : undefined,
				networkRef,
				operatorRef,
				vehicleRef: vehicleRef !== undefined ? `${networkRef}:${operatorRef ?? ""}:Vehicle:${vehicleRef}` : undefined,
				serviceDate: journey?.date.toString(),
				updatedAt: updatedAt.toString(),
			};

			if (source.options.isValidJourney === undefined || source.options.isValidJourney(vehicleJourney)) {
				activeJourneys.set(key, vehicleJourney);
			}
		}

		if (source.options.mode !== "VP-ONLY" && source.options.mode !== "NO-TU") {
			for (const { tripUpdate, calls: addedCalls, startDate, shape, candidate } of addedTrips) {
				const candidateJourney = candidate?.trip.getScheduledJourney(candidate.date, true);
				const vehicleDescriptor = tripUpdate.vehicle;
				const route =
					candidate?.trip.route ??
					(tripUpdate.trip.routeId !== undefined ? source.gtfs.routes.get(tripUpdate.trip.routeId) : undefined);

				const networkRef = source.options.getNetworkRef(candidateJourney, vehicleDescriptor);
				const operatorRef = source.options.getOperatorRef?.(candidateJourney, vehicleDescriptor);
				const vehicleRef =
					source.options.getVehicleRef !== undefined
						? source.options.getVehicleRef(vehicleDescriptor, candidateJourney)
						: (vehicleDescriptor?.label ?? vehicleDescriptor?.id);

				// `trip_properties.trip_id` nomme la course supplémentaire ; le descripteur ne porte que
				// l'identifiant technique qui la distingue dans le flux.
				const rawTripRef = tripUpdate.tripProperties?.tripId ?? tripUpdate.trip.tripId;
				const tripRef = rawTripRef !== undefined ? (source.options.mapTripRef?.(rawTripRef) ?? rawTripRef) : undefined;

				const key =
					vehicleDescriptor !== undefined
						? `${networkRef}:${operatorRef ?? ""}:VehicleTracking:${vehicleDescriptor.id}`
						: `${networkRef}:${operatorRef ?? ""}:ServiceJourney:${tripRef ?? startDate}:${startDate}`;

				if (activeJourneys.has(key)) continue;

				const calls = getActiveAddedCalls(addedCalls, now, source.options.getAheadTime?.(candidateJourney) ?? 0);
				if (calls === undefined || calls.length === 0) continue;

				const timeZone = route?.agency.timeZone ?? "Europe/Paris";

				// Sans tracé, la course ne peut être qu'ancrée à son dernier arrêt desservi : mieux vaut
				// un véhicule qui saute d'arrêt en arrêt qu'un véhicule placé à vue de nez.
				const position =
					shape !== undefined
						? guessPositionFromCalls(addedCalls, shape, now, timeZone)
						: getPositionFromLastPassedAddedCall(addedCalls, now, timeZone);
				if (position === undefined) continue;

				const pathRef =
					shape !== undefined && !source.options.disableRoutePaths
						? `${networkRef}:RoutePath:${source.id}:${shape.id}`
						: undefined;

				if (pathRef !== undefined && !paths.has(pathRef)) {
					paths.set(pathRef, shape!.asPath());
				}

				const directionId = tripUpdate.trip.directionId ?? candidate?.trip.direction;

				const vehicleJourney: VehicleJourney = {
					id: key,
					line:
						route !== undefined
							? {
									ref: `${networkRef}:Line:${source.options.mapLineRef?.(route.id) ?? route.id}`,
									number: route.name,
									type: route.type,
									color: route.color,
									textColor: route.textColor,
								}
							: tripUpdate.trip.routeId !== undefined
								? {
										ref: `${networkRef}:Line:${
											source.options.mapLineRef?.(tripUpdate.trip.routeId) ?? tripUpdate.trip.routeId
										}`,
										number: tripUpdate.trip.routeId,
										type: "UNKNOWN",
									}
								: undefined,
					...(directionId !== undefined
						? { direction: directionId === 0 ? ("OUTBOUND" as const) : ("INBOUND" as const) }
						: {}),
					destination:
						source.options.getDestination?.(candidateJourney, vehicleDescriptor) ??
						tripUpdate.tripProperties?.tripHeadsign ??
						getCurrentCallHeadsign(addedCalls, now) ??
						(candidateJourney !== undefined ? getCurrentStopHeadsign(candidateJourney, now) : undefined) ??
						candidate?.trip.headsign,
					missionCode: source.options.getMissionCode?.(candidateJourney, vehicleDescriptor) ?? undefined,
					calls: calls.map((call, index) =>
						serializeCall(call, index === calls.length - 1, source, networkRef, timeZone),
					),
					position,
					pathRef,
					isAdded: true,
					journeyRef: tripRef !== undefined ? `${networkRef}:ServiceJourney:${tripRef}` : undefined,
					networkRef,
					operatorRef,
					vehicleRef: vehicleRef !== undefined ? `${networkRef}:${operatorRef ?? ""}:Vehicle:${vehicleRef}` : undefined,
					serviceDate: startDate.toString(),
					updatedAt: Temporal.Instant.fromEpochMilliseconds(tripUpdate.timestamp * 1000).toString(),
				};

				if (shape !== undefined) positionShapes.set(vehicleJourney, shape);

				if (source.options.isValidJourney === undefined || source.options.isValidJourney(vehicleJourney)) {
					activeJourneys.set(key, vehicleJourney);
				}
			}
		}

		if (source.options.mode !== "VP-ONLY") {
			const nowStr = now.toString();
			const graceMs = source.getTerminusGraceMs(nowMs);
			// Publications finales des courses arrivées à leur terminus depuis le dernier cycle. Elles
			// sont différées car l'ordre d'itération de la Map n'est pas chronologique : itérées avant
			// la course suivante du même roulement, elles lui voleraient sa clé et la feraient
			// disparaître alors qu'elle est bien en service.
			const endedJourneys: { key: string; block: string | undefined; vehicleJourney: VehicleJourney }[] = [];

			for (const journey of source.gtfs.journeys.values()) {
				if (handledJourneyIds.has(journey.id)) continue;
				if (canceledJourneyIds.has(journey.id)) continue;
				if (journey.trip.block !== undefined && handledBlockIds.has(journey.trip.block)) continue;

				const vehicleDescriptor = journey.vehicleDescriptor;

				const networkRef = source.options.getNetworkRef(journey);
				const operatorRef = source.options.getOperatorRef?.(journey, vehicleDescriptor);
				const tripRef = source.options.mapTripRef?.(journey.trip.id) ?? journey.trip.id;

				if (journey.hasRealtime()) {
					if (source.options.mode === "NO-TU") continue;
				} else {
					if (source.options.excludeScheduled === true) continue;
					if (typeof source.options.excludeScheduled === "function" && source.options.excludeScheduled?.(journey.trip))
						continue;
				}

				const key =
					vehicleDescriptor !== undefined
						? `${networkRef}:${operatorRef ?? ""}:VehicleTracking:${vehicleDescriptor.id}`
						: journey.trip.block !== undefined
							? `${networkRef}:${operatorRef ?? ""}:ServiceBlock:${journey.trip.block}:${journey.date}`
							: `${networkRef}:${operatorRef ?? ""}:ServiceJourney:${tripRef}:${journey.date}`;

				if (activeJourneys.has(key)) continue;

				const calls = getCalls(journey, now, source.options.getAheadTime, graceMs);
				if (calls === undefined || calls.length === 0) continue;

				// getCalls renvoie toujours un suffixe des calls : son dernier élément est le terminus.
				const terminusCall = calls[calls.length - 1]!;
				const hasEnded = nowMs >= (terminusCall.expectedArrivalTime ?? terminusCall.aimedArrivalTime);

				// Une course suivie en GPS a déjà sa propre entrée dans le store aval (clé
				// VehicleTracking, conservée jusqu'à 10 min) : une publication de grâce sous une autre
				// clé la dupliquerait.
				if (
					hasEnded &&
					journey.lastVehiclePositionAtMs !== undefined &&
					nowMs - journey.lastVehiclePositionAtMs < VEHICLE_POSITION_RETENTION_MS
				)
					continue;

				// La publication de grâce ne fait que finaliser le marqueur existant. Si la clé a changé
				// depuis, c'est que le véhicule a quitté la course au terminus (le TripUpdate reste dans le
				// flux sans descripteur, cas de Tisséo) : il poursuit sous sa clé VehicleTracking, et
				// publier la course sous une nouvelle clé ferait apparaître un marqueur fantôme.
				if (hasEnded && journey.lastPublishedKey !== undefined && journey.lastPublishedKey !== key) continue;

				const vehicleRef =
					source.options.getVehicleRef !== undefined
						? source.options.getVehicleRef(vehicleDescriptor, journey)
						: (vehicleDescriptor?.label ?? vehicleDescriptor?.id);

				if (journey.trip.block !== undefined && !hasEnded) {
					handledBlockIds.add(journey.trip.block);
				}

				const pathRef =
					!source.options.disableRoutePaths && journey?.shape !== undefined
						? `${networkRef}:RoutePath:${source.id}:${journey.shape.id}`
						: undefined;

				if (pathRef !== undefined && !paths.has(pathRef)) {
					paths.set(pathRef, journey!.shape!.asPath());
				}

				const cancelledPathRef = resolveCancelledPathRef(journey, source, networkRef, paths);

				const timeZone = journey.trip.route.agency.timeZone;

				const vehicleJourney: VehicleJourney = {
					id: key,
					line: {
						ref: `${networkRef}:Line:${source.options.mapLineRef?.(journey.trip.route.id) ?? journey.trip.route.id}`,
						number: journey.trip.route.name,
						type: journey.trip.route.type,
						color: journey.trip.route.color,
						textColor: journey.trip.route.textColor,
					},
					direction: journey.trip.direction === 0 ? "OUTBOUND" : "INBOUND",
					destination:
						source.options.getDestination?.(journey, vehicleDescriptor) ??
						getCurrentStopHeadsign(journey, now) ??
						journey.trip.headsign,
					missionCode: source.options.getMissionCode?.(journey, vehicleDescriptor) ?? undefined,
					calls: calls.map((call, index) =>
						serializeCall(call, index === calls.length - 1, source, networkRef, timeZone),
					),
					position: journey.guessPosition(now),
					pathRef,
					cancelledPathRef,
					journeyRef: `${networkRef}:ServiceJourney:${tripRef}`,
					networkRef,
					operatorRef,
					vehicleRef: vehicleRef !== undefined ? `${networkRef}:${operatorRef ?? ""}:Vehicle:${vehicleRef}` : undefined,
					serviceDate: journey.date.toString(),
					updatedAt: nowStr,
				};

				if (journey.shape !== undefined) positionShapes.set(vehicleJourney, journey.shape);

				if (source.options.isValidJourney === undefined || source.options.isValidJourney(vehicleJourney)) {
					if (hasEnded) {
						endedJourneys.push({ key, block: journey.trip.block, vehicleJourney });
					} else {
						activeJourneys.set(key, vehicleJourney);
						journey.lastPublishedKey = key;
					}
				}
			}

			// Une course active occupe toujours la place en priorité sur une publication finale.
			for (const { key, block, vehicleJourney } of endedJourneys) {
				if (activeJourneys.has(key)) continue;
				if (block !== undefined) {
					if (handledBlockIds.has(block)) continue;
					handledBlockIds.add(block);
				}
				activeJourneys.set(key, vehicleJourney);
			}
		}

		// Libère les calls des voyages terminés sans RT. Les voyages actifs/futurs conservent
		// leur cache pour éviter de re-calculer computeCallsForDate() à chaque cycle.
		for (const journey of source.gtfs!.journeys.values()) {
			journey.releaseUnmodifiedCalls(nowMs);
		}

		// Plusieurs courses calculées peuvent stationner au même arrêt : on les met en file sur leur
		// tracé pour qu'elles restent toutes visibles et sélectionnables sur la carte.
		const stackedCount = stackStoppedPositions(activeJourneys.values(), (vehicleJourney) =>
			positionShapes.get(vehicleJourney),
		);

		// Certains SAE recalent plusieurs véhicules sur un point identique du tracé : on les écarte
		// juste avant publication pour qu'ils restent tous visibles et sélectionnables sur la carte.
		const scatteredCount = scatterOverlappingPositions(activeJourneys.values());

		const computeTime = watch.step();
		updateLog(
			"%s     ✓ Computed %d journeys and %d paths in %dms (%dms download - %dms compute)%s%s.",
			sourceId,
			activeJourneys.size,
			paths.size,
			watch.total(),
			downloadTime,
			computeTime,
			scatteredCount > 0 ? ` - ${scatteredCount} overlapping positions scattered` : "",
			stackedCount > 0 ? ` - ${stackedCount} stopped positions queued` : "",
		);

		// Écrit en toute fin de bloc `try` : la fenêtre de grâce se mesure depuis le dernier cycle
		// effectivement publié. En cas d'échec (téléchargement du flux RT le plus souvent), rien n'est
		// publié et l'affichage date toujours du dernier succès : la fenêtre doit remonter jusqu'à lui.
		source.lastComputeAtMs = nowMs;

		const journeys = Array.from(activeJourneys.values());

		if (source.options.hasRealVehicles === false) {
			for (const journey of journeys) {
				journey.hasRealVehicle = false;
			}
		}

		return {
			journeys,
			paths: Object.fromEntries(paths),
		};
	} catch (cause) {
		updateLog("%s     ✘ Something wrong occurred during computation.", sourceId);
		throw new Error(`Failed to compute vehicle journeys for '${source.id}'.`, {
			cause,
		});
	}
}

/**
 * Arrêts du flux temps réel effectivement desservis par une course déviée, chacun en sa propre
 * station. Un arrêt que le flux déclare sans qu'aucune course ne le desserve n'intéresse personne.
 */
function collectRealtimeStopAreas(source: Source) {
	const stopAreas = new Map<string, StopArea>();
	const gtfs = source.gtfs;
	if (gtfs === undefined) return stopAreas;

	for (const journeyKey of source.modifiedJourneyKeys) {
		const journey = gtfs.journeys.get(journeyKey);
		if (journey === undefined) continue;

		for (const call of journey.calls) {
			if (call.status === "SKIPPED" || gtfs.stops.has(call.stop.id) || stopAreas.has(call.stop.id)) continue;
			const { id, name, latitude, longitude } = call.stop;
			stopAreas.set(id, new StopArea(id, name, latitude, longitude, [call.stop]));
		}
	}

	return stopAreas;
}

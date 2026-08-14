import type { VehicleJourneyPosition } from "@bus-tracker/contracts";

import type { Gtfs } from "../model/gtfs.js";
import type { StopTimeUpdate, TripUpdate } from "../model/gtfs-rt.js";
import { getBoundedArrivalMs, type JourneyCall } from "../model/journey.js";
import type { Shape } from "../model/shape.js";
import type { Trip } from "../model/trip.js";

const DEFAULT_MAX_STOP_TIME_DELTA_SECONDS = 15 * 60;
const DEFAULT_MIN_MATCHED_STOPS = 2;
const DEFAULT_MIN_MATCHED_STOP_RATIO = 0.6;

export type TripShapeMatchCandidate = {
	date: Temporal.PlainDate;
	trip: Trip;
	calls: JourneyCall[];
};

export type AddedTripShapeMatch = {
	candidate: TripShapeMatchCandidate;
	calls: JourneyCall[];
};

function getStopTimeMs(stopTimeUpdate: StopTimeUpdate) {
	const time = stopTimeUpdate.arrival?.time ?? stopTimeUpdate.departure?.time;
	return typeof time === "number" ? time * 1000 : undefined;
}

export function createCallsFromTripUpdate(gtfs: Gtfs, tripUpdate?: TripUpdate): JourneyCall[] | undefined {
	if (tripUpdate?.stopTimeUpdate === undefined) return;

	const calls = tripUpdate.stopTimeUpdate.flatMap((stopTimeUpdate, index) => {
		const arrivalTimeMs = getStopTimeMs(stopTimeUpdate);
		if (arrivalTimeMs === undefined) return [];

		const departureTimeMs = (stopTimeUpdate.departure?.time ?? stopTimeUpdate.arrival?.time)! * 1000;
		const stop = gtfs.stops.get(stopTimeUpdate.stopId);
		if (stop === undefined) return [];
		const assignedStop = stopTimeUpdate.stopTimeProperties?.assignedStopId
			? gtfs.stops.get(stopTimeUpdate.stopTimeProperties.assignedStopId)
			: undefined;

		return {
			aimedArrivalTime: arrivalTimeMs,
			expectedArrivalTime: arrivalTimeMs,
			aimedDepartureTime: departureTimeMs,
			expectedDepartureTime: departureTimeMs,
			sequence: stopTimeUpdate.stopSequence ?? index,
			stop,
			platform: assignedStop?.platformCode ?? stop.platformCode,
			status: "UNSCHEDULED" as const,
			flags: [],
		};
	});

	return calls.length > 0 ? calls : undefined;
}

function getCallTimeMs(call: JourneyCall) {
	return call.expectedArrivalTime ?? call.aimedArrivalTime;
}

function scoreCandidate(addedCalls: JourneyCall[], candidate: TripShapeMatchCandidate, maxStopTimeDeltaMs: number) {
	const pairs: {
		addedIndex: number;
		staticIndex: number;
		deltaMs: number;
		matchedStops: number;
		totalDeltaMs: number;
		previousIndex?: number;
	}[] = [];

	for (let addedIndex = 0; addedIndex < addedCalls.length; addedIndex++) {
		const addedCall = addedCalls[addedIndex]!;
		const addedTimeMs = getCallTimeMs(addedCall);

		for (let staticIndex = 0; staticIndex < candidate.calls.length; staticIndex++) {
			const staticCall = candidate.calls[staticIndex]!;
			if (staticCall.stop.id !== addedCall.stop.id) continue;

			const deltaMs = Math.abs(getCallTimeMs(staticCall) - addedTimeMs);
			if (deltaMs > maxStopTimeDeltaMs) continue;

			let bestPreviousIndex: number | undefined;
			let matchedStops = 1;
			let totalDeltaMs = deltaMs;

			for (let previousIndex = 0; previousIndex < pairs.length; previousIndex++) {
				const previousPair = pairs[previousIndex]!;
				if (previousPair.addedIndex >= addedIndex || previousPair.staticIndex >= staticIndex) continue;

				const candidateMatchedStops = previousPair.matchedStops + 1;
				const candidateTotalDeltaMs = previousPair.totalDeltaMs + deltaMs;
				if (
					candidateMatchedStops > matchedStops ||
					(candidateMatchedStops === matchedStops && candidateTotalDeltaMs < totalDeltaMs)
				) {
					bestPreviousIndex = previousIndex;
					matchedStops = candidateMatchedStops;
					totalDeltaMs = candidateTotalDeltaMs;
				}
			}

			pairs.push({
				addedIndex,
				staticIndex,
				deltaMs,
				matchedStops,
				totalDeltaMs,
				previousIndex: bestPreviousIndex,
			});
		}
	}

	let bestPairIndex: number | undefined;
	for (let index = 0; index < pairs.length; index++) {
		const pair = pairs[index]!;
		if (
			bestPairIndex === undefined ||
			pair.matchedStops > pairs[bestPairIndex]!.matchedStops ||
			(pair.matchedStops === pairs[bestPairIndex]!.matchedStops &&
				pair.totalDeltaMs < pairs[bestPairIndex]!.totalDeltaMs)
		) {
			bestPairIndex = index;
		}
	}

	const matchedStaticCalls = new Map<JourneyCall, JourneyCall>();
	let cursor = bestPairIndex;
	while (cursor !== undefined) {
		const pair = pairs[cursor]!;
		const addedCall = addedCalls[pair.addedIndex]!;
		matchedStaticCalls.set(addedCall, candidate.calls[pair.staticIndex]!);
		cursor = pair.previousIndex;
	}

	return {
		matchedStaticCalls,
		matchedStops: bestPairIndex !== undefined ? pairs[bestPairIndex]!.matchedStops : 0,
		totalDeltaMs: bestPairIndex !== undefined ? pairs[bestPairIndex]!.totalDeltaMs : 0,
	};
}

export function findAddedTripShapeMatch(
	tripUpdate: TripUpdate,
	addedCalls: JourneyCall[],
	startDate: Temporal.PlainDate,
	candidates: Iterable<TripShapeMatchCandidate>,
): AddedTripShapeMatch | undefined {
	const routeId = tripUpdate.trip.routeId;
	if (routeId === undefined) return;

	const maxStopTimeDeltaMs = DEFAULT_MAX_STOP_TIME_DELTA_SECONDS * 1000;
	const minMatchedStops = DEFAULT_MIN_MATCHED_STOPS;
	const minMatchedStopRatio = DEFAULT_MIN_MATCHED_STOP_RATIO;

	let best:
		| {
				candidate: TripShapeMatchCandidate;
				matchedStaticCalls: Map<JourneyCall, JourneyCall>;
				matchedStops: number;
				totalDeltaMs: number;
		  }
		| undefined;

	for (const candidate of candidates) {
		if (!candidate.date.equals(startDate)) continue;
		if (candidate.trip.route.id !== routeId) continue;
		if (candidate.trip.shape === undefined) continue;

		const score = scoreCandidate(addedCalls, candidate, maxStopTimeDeltaMs);
		if (score.matchedStops !== addedCalls.length) continue;
		if (score.matchedStops < Math.min(minMatchedStops, addedCalls.length)) continue;
		if (score.matchedStops / addedCalls.length < minMatchedStopRatio) continue;

		if (
			best === undefined ||
			score.matchedStops > best.matchedStops ||
			(score.matchedStops === best.matchedStops && score.totalDeltaMs < best.totalDeltaMs)
		) {
			best = { candidate, ...score };
		}
	}

	if (best === undefined) return;

	return {
		candidate: best.candidate,
		calls: addedCalls.map((call) => {
			const staticCall = best.matchedStaticCalls.get(call);
			return {
				...call,
				distanceTraveled:
					staticCall?.distanceTraveled ??
					best.candidate.trip.shape!.findClosestPointDistance(call.stop.latitude, call.stop.longitude),
			};
		}),
	};
}

export function findAddedTripShapeMatchWithFallback(
	tripUpdate: TripUpdate,
	addedCalls: JourneyCall[],
	startDate: Temporal.PlainDate,
	priorityCandidates: Iterable<TripShapeMatchCandidate>,
	fallbackCandidates: Iterable<TripShapeMatchCandidate>,
) {
	return (
		findAddedTripShapeMatch(tripUpdate, addedCalls, startDate, priorityCandidates) ??
		findAddedTripShapeMatch(tripUpdate, addedCalls, startDate, fallbackCandidates)
	);
}

function getPositionAtCall(call: JourneyCall, at: Temporal.Instant, timeZone: string): VehicleJourneyPosition {
	return {
		latitude: call.stop.latitude,
		longitude: call.stop.longitude,
		atStop: true,
		type: "COMPUTED",
		distanceTraveled: call.distanceTraveled,
		recordedAt: at.toZonedDateTimeISO(call.stop.timeZone ?? timeZone).toString({ timeZoneName: "never" }),
	};
}

/**
 * Équivalent stateless de {@link Journey.guessPosition} pour les courses ADDED, qui n'ont pas
 * d'objet Journey. Le guard anti-recul ne s'y applique donc pas : leur distanceTraveled provient
 * d'un appariement de shape recalculé à chaque cycle, une distance mémorisée pourrait changer de
 * référentiel d'un cycle à l'autre.
 */
export function guessPositionFromCalls(
	calls: JourneyCall[],
	shape: Shape,
	at: Temporal.Instant,
	timeZone: string,
): VehicleJourneyPosition | undefined {
	const activeCalls = calls.filter((call) => call.status !== "SKIPPED" && call.distanceTraveled !== undefined);
	if (activeCalls.length === 0) return;

	const atMs = at.epochMilliseconds;
	const firstCall = activeCalls[0]!;
	const lastCall = activeCalls[activeCalls.length - 1]!;

	if (atMs <= (firstCall.expectedDepartureTime ?? firstCall.aimedDepartureTime)) {
		return getPositionAtCall(firstCall, at, timeZone);
	}

	if (atMs >= (lastCall.expectedArrivalTime ?? lastCall.aimedArrivalTime)) {
		return getPositionAtCall(lastCall, at, timeZone);
	}

	const currentCallIndex = activeCalls.findLastIndex(
		(call) => atMs >= (call.expectedArrivalTime ?? call.aimedArrivalTime),
	);
	const currentCall = activeCalls[currentCallIndex]!;
	const departureMs = currentCall.expectedDepartureTime ?? currentCall.aimedDepartureTime;

	if (atMs <= departureMs) return getPositionAtCall(currentCall, at, timeZone);

	const nextCall = activeCalls[currentCallIndex + 1];
	if (currentCall.distanceTraveled === undefined || nextCall?.distanceTraveled === undefined) {
		return getPositionAtCall(currentCall, at, timeZone);
	}

	const arrivalMs = getBoundedArrivalMs(activeCalls, currentCallIndex + 1);

	const ratio = Math.max(0, Math.min(1, (atMs - departureMs) / (arrivalMs - departureMs)));
	const distanceTraveled =
		currentCall.distanceTraveled + (nextCall.distanceTraveled - currentCall.distanceTraveled) * ratio;
	const point = shape.interpolateAt(distanceTraveled);
	if (point === undefined) return getPositionAtCall(currentCall, at, timeZone);

	return {
		latitude: point.latitude,
		longitude: point.longitude,
		bearing: point.bearing,
		atStop: false,
		type: "COMPUTED",
		distanceTraveled,
		recordedAt: at.toZonedDateTimeISO(currentCall.stop.timeZone ?? timeZone).toString({ timeZoneName: "never" }),
	};
}

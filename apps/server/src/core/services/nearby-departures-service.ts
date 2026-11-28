import { localIdOf } from "@bus-tracker/contracts";

import { boundsAround, type Coordinates, distanceMeters } from "../../utils/geo.js";
import { useCache } from "../../utils/use-cache.js";
import { findStopAreasWithin, type StopArea } from "./stop-area-service.js";
import { DEPARTURES_LIMIT, loadStopBoard, type ResolvedDeparture, type StopBoard } from "./stop-board-service.js";

const SEARCH_RADIUS_M = 15_000;
const CANDIDATES_LIMIT = 40;
const BOARDS_LIMIT = 20;
const BOARDS_BATCH_SIZE = 4;
const NEARBY_DEPARTURES_LIMIT = 15;
const WALKING_METERS_PER_MINUTE = 4_500 / 60;
const STREET_DETOUR_FACTOR = 1.3;
const POSITION_GRID_STEP = 0.0005;

export const walkMinutesOf = (distance: number) => (distance * STREET_DETOUR_FACTOR) / WALKING_METERS_PER_MINUTE;

const minimumScoreAt = (distance: number) => 2 * walkMinutesOf(distance);

type Candidate = {
	departure: ResolvedDeparture;
	stopArea: StopArea;
	distance: number;
	score: number;
};

function snapToGrid({ latitude, longitude }: Coordinates): Coordinates {
	const snap = (value: number) => Number((Math.round(value / POSITION_GRID_STEP) * POSITION_GRID_STEP).toFixed(4));
	return { latitude: snap(latitude), longitude: snap(longitude) };
}

export function nearbyKeyOf(position: Coordinates) {
	const { latitude, longitude } = snapToGrid(position);
	return `${latitude}|${longitude}`;
}

function journeyKeyOf(departure: ResolvedDeparture) {
	if (departure.journeyRef !== undefined) return `${departure.journeyRef}|${departure.serviceDate ?? ""}`;
	if (departure.journeyId !== undefined) return departure.journeyId;
	return `${departure.lineId}|${departure.destination ?? ""}|${departure.aimedTime}|${departure.stopRef}`;
}

function locateStop(stopArea: StopArea, stopRef: string): Coordinates {
	const stopPoints = stopArea.stopPoints ?? [];
	const exact = stopPoints.find((stopPoint) => stopPoint.ref === stopRef);
	if (exact !== undefined) return exact;

	const stopId = localIdOf(stopRef, "StopPoint");
	const sameStop =
		stopId !== undefined ? stopPoints.find((stopPoint) => localIdOf(stopPoint.ref, "StopPoint") === stopId) : undefined;
	return sameStop ?? stopArea;
}

function isSaturated(board: StopBoard) {
	return board.departures.length >= DEPARTURES_LIMIT;
}

function collectCandidates(position: Coordinates, board: StopBoard, nowMs: number) {
	const candidates: Candidate[] = [];
	for (const departure of board.departures) {
		if (departure.lineId === undefined || departure.callStatus === "SKIPPED" || departure.canceled === true) continue;

		const distance = distanceMeters(position, locateStop(board.stopArea, departure.stopRef));
		const walkMinutes = walkMinutesOf(distance);
		const delayMinutes = (Date.parse(departure.expectedTime ?? departure.aimedTime) - nowMs) / 60_000;
		if (Number.isNaN(delayMinutes) || delayMinutes < walkMinutes) continue;

		candidates.push({ departure, stopArea: board.stopArea, distance, score: delayMinutes + walkMinutes });
	}
	return candidates;
}

function saturationFloorOf(position: Coordinates, board: StopBoard, nowMs: number) {
	const last = board.departures.at(-1);
	if (!isSaturated(board) || last === undefined) return Number.POSITIVE_INFINITY;

	const delayMinutes = (Date.parse(last.expectedTime ?? last.aimedTime) - nowMs) / 60_000;
	return delayMinutes + walkMinutesOf(distanceMeters(position, board.stopArea));
}

const byScore = (a: Candidate, b: Candidate) => a.score - b.score || a.distance - b.distance;

export async function computeNearbyDepartures(position: Coordinates, nowMs = Date.now()) {
	const stopAreas = (await findStopAreasWithin(boundsAround(position, SEARCH_RADIUS_M), { limit: CANDIDATES_LIMIT }))
		.map((stopArea) => ({ stopArea, distance: distanceMeters(position, stopArea) }))
		.filter(({ distance }) => distance <= SEARCH_RADIUS_M)
		.sort((a, b) => a.distance - b.distance)
		.slice(0, BOARDS_LIMIT);

	const best = new Map<string, Candidate>();
	let floor = Number.POSITIVE_INFINITY;

	const ranked = () =>
		[...best.values()]
			.filter(({ score }) => score <= floor)
			.sort(byScore)
			.slice(0, NEARBY_DEPARTURES_LIMIT);

	for (let index = 0; index < stopAreas.length; index += BOARDS_BATCH_SIZE) {
		const nextMinimumScore = minimumScoreAt(stopAreas[index]!.distance);
		if (nextMinimumScore > floor) break;
		const current = ranked();
		if (current.length >= NEARBY_DEPARTURES_LIMIT && nextMinimumScore > current.at(-1)!.score) break;

		const batch = stopAreas.slice(index, index + BOARDS_BATCH_SIZE);
		const results = await Promise.all(
			batch.map(({ stopArea }) =>
				loadStopBoard(stopArea.ref, "departures").catch((error: unknown) => {
					console.error(`✘ Failed to build departures of stop '${stopArea.ref}':`, error);
					return undefined;
				}),
			),
		);

		for (const result of results) {
			if (result === undefined || "error" in result) continue;
			const { board } = result;

			floor = Math.min(floor, saturationFloorOf(position, board, nowMs));
			for (const candidate of collectCandidates(position, board, nowMs)) {
				const key = journeyKeyOf(candidate.departure);
				const known = best.get(key);
				if (known === undefined || byScore(candidate, known) < 0) best.set(key, candidate);
			}
		}
	}

	return {
		departures: ranked().map(
			({ departure: { lineRef, journeyRef, serviceDate, ...departure }, stopArea, distance }) => ({
				...departure,
				stopAreaRef: stopArea.ref,
				stopAreaName: stopArea.name,
				distance: Math.round(distance),
			}),
		),
		at: Temporal.Now.instant(),
	};
}

export type NearbyDeparturesPayload = Awaited<ReturnType<typeof computeNearbyDepartures>>;

const nearbyCache = useCache<NearbyDeparturesPayload>(4_000, 1_024);

export function buildNearbyDepartures(position: Coordinates) {
	return nearbyCache.getOrLoad(nearbyKeyOf(position), () => computeNearbyDepartures(snapToGrid(position)));
}

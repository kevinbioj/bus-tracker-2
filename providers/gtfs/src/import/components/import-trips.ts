import { join } from "node:path";

import type { Route } from "../../model/route.js";
import { Service } from "../../model/service.js";
import type { Shape } from "../../model/shape.js";
import type { Stop } from "../../model/stop.js";
import { StopTimeStore } from "../../model/stop-time-store.js";
import { Trip } from "../../model/trip.js";
import { type CsvRecord, readCsv } from "../../utils/csv-reader.js";
import { getDistance } from "../../utils/get-distance.js";

import type { ImportGtfsOptions } from "../import-gtfs.js";

type TripRecord = CsvRecord<
	"trip_id" | "route_id" | "service_id",
	"direction_id" | "trip_headsign" | "block_id" | "shape_id"
>;
type StopTimeRecord = CsvRecord<
	"trip_id" | "arrival_time" | "departure_time" | "stop_sequence" | "stop_id",
	"shape_dist_traveled" | "pickup_type" | "drop_off_type"
>;

/** Convertit "HH:MM:SS" (HH peut dépasser 24) en secondes depuis minuit du jour 0. */
function parseTimeToSecs(time: string): number {
	const c1 = time.indexOf(":");
	const c2 = time.indexOf(":", c1 + 1);
	const h = +time.slice(0, c1);
	const m = +time.slice(c1 + 1, c2);
	const s = +time.slice(c2 + 1);
	return h * 3600 + m * 60 + s;
}

export async function importTrips(
	gtfsDirectory: string,
	{ filterTrips, mapTripId, mapRouteId, mapStopId, ignoreBlocks, computeShapeDistTraveled }: ImportGtfsOptions,
	routes: Map<string, Route>,
	services: Map<string, Service>,
	shapes: Map<string, Shape>,
	stops: Map<string, Stop>,
): Promise<{ trips: Map<string, Trip>; stopTimeStore: StopTimeStore }> {
	const trips = new Map<string, Trip>();
	const excludedTripIds = new Set<string>();

	// Store vide partagé : populé en place après les deux passes sur stop_times.txt.
	// On le construit dès maintenant pour que chaque Trip puisse y détenir une référence.
	const placeholderStore = new StopTimeStore(
		[],
		new Uint32Array(0),
		new Uint8Array(0),
		new Uint32Array(0),
		new Uint32Array(0),
		new Float32Array(0),
	);

	const stopTimesFile = join(gtfsDirectory, "stop_times.txt");

	await readCsv<TripRecord>(join(gtfsDirectory, "trips.txt"), (tripRecord) => {
		const tripId = mapTripId?.(tripRecord.trip_id) ?? tripRecord.trip_id;
		const routeId = mapRouteId?.(tripRecord.route_id) ?? tripRecord.route_id;

		const route = routes.get(routeId);
		if (route === undefined) {
			throw new Error(`Unknown route with id '${routeId}' for trip '${tripId}'.`);
		}

		let service = services.get(tripRecord.service_id);
		if (service === undefined) {
			service = new Service(tripRecord.service_id);
			services.set(service.id, service);
		}

		const trip = new Trip(
			tripId,
			route,
			service,
			placeholderStore,
			+(tripRecord.direction_id ?? 0) as 0 | 1,
			tripRecord.trip_headsign || undefined,
			tripRecord.block_id !== undefined && tripRecord.block_id.length > 0 && !ignoreBlocks
				? tripRecord.block_id
				: undefined,
			tripRecord.shape_id !== undefined ? shapes.get(tripRecord.shape_id) : undefined,
		);

		if (filterTrips === undefined || filterTrips(trip)) {
			trips.set(trip.id, trip);
		} else {
			excludedTripIds.add(trip.id);
		}
	});

	// Pass 1: compter les stop_times par trip pour dimensionner les tableaux.
	let totalRows = 0;
	await readCsv<StopTimeRecord>(stopTimesFile, (stopTimeRecord) => {
		const tripId = mapTripId?.(stopTimeRecord.trip_id) ?? stopTimeRecord.trip_id;
		const trip = trips.get(tripId);
		if (trip === undefined) return;
		trip.stopTimeCount += 1;
		totalRows += 1;
	});

	// Calcul des offsets (prefix sum) et alloc des tableaux finaux.
	const sequence = new Uint32Array(totalRows);
	const flagsBitmask = new Uint8Array(totalRows);
	const arrivalSecs = new Uint32Array(totalRows);
	const departureSecs = new Uint32Array(totalRows);
	const distanceTraveled = new Float32Array(totalRows);
	const stopRefs: Stop[] = new Array(totalRows);

	let cursor = 0;
	const writeCursor = new Map<string, number>();
	for (const trip of trips.values()) {
		trip.stopTimeStart = cursor;
		writeCursor.set(trip.id, cursor);
		cursor += trip.stopTimeCount;
	}

	// Pass 2: remplissage.
	await readCsv<StopTimeRecord>(stopTimesFile, (stopTimeRecord) => {
		const tripId = mapTripId?.(stopTimeRecord.trip_id) ?? stopTimeRecord.trip_id;
		const trip = trips.get(tripId);
		if (trip === undefined) {
			if (excludedTripIds.has(tripId)) return;
			throw new Error(
				`Unknown trip with id '${tripId}' for {${stopTimeRecord.stop_sequence}/${stopTimeRecord.stop_id}/${stopTimeRecord.arrival_time}/${stopTimeRecord.departure_time}}.`,
			);
		}

		const stopId = mapStopId?.(stopTimeRecord.stop_id) ?? stopTimeRecord.stop_id;
		const stop = stops.get(stopId);
		if (stop === undefined) {
			throw new Error(
				`Unknown stop with id '${stopId}' for {${stopTimeRecord.stop_sequence}/${stopId}/${stopTimeRecord.arrival_time}/${stopTimeRecord.departure_time}}.`,
			);
		}

		const idx = writeCursor.get(tripId)!;
		writeCursor.set(tripId, idx + 1);

		const aSecs = parseTimeToSecs(stopTimeRecord.arrival_time);
		const dSecs =
			stopTimeRecord.arrival_time === stopTimeRecord.departure_time
				? aSecs
				: parseTimeToSecs(stopTimeRecord.departure_time);

		stopRefs[idx] = stop;
		sequence[idx] = +stopTimeRecord.stop_sequence;
		flagsBitmask[idx] =
			(stopTimeRecord.pickup_type === "1" ? 1 : 0) | (stopTimeRecord.drop_off_type === "1" ? 2 : 0);
		arrivalSecs[idx] = aSecs;
		departureSecs[idx] = dSecs;
		distanceTraveled[idx] =
			stopTimeRecord.shape_dist_traveled !== undefined ? +stopTimeRecord.shape_dist_traveled : Number.NaN;
	});

	// Tri par sequence à l'intérieur de chaque slice de trip.
	let maxCount = 0;
	for (const trip of trips.values()) {
		if (trip.stopTimeCount > maxCount) maxCount = trip.stopTimeCount;
	}
	const idxBuf = new Uint32Array(maxCount);
	const tmpStops: Stop[] = new Array(maxCount);
	const tmpSeq = new Uint32Array(maxCount);
	const tmpFlags = new Uint8Array(maxCount);
	const tmpArr = new Uint32Array(maxCount);
	const tmpDep = new Uint32Array(maxCount);
	const tmpDist = new Float32Array(maxCount);

	for (const trip of trips.values()) {
		const start = trip.stopTimeStart;
		const count = trip.stopTimeCount;
		if (count <= 1) continue;

		// Vérifie si déjà trié (cas le plus courant, fast-path).
		let alreadySorted = true;
		for (let i = 1; i < count; i++) {
			if (sequence[start + i]! < sequence[start + i - 1]!) {
				alreadySorted = false;
				break;
			}
		}
		if (alreadySorted) continue;

		for (let i = 0; i < count; i++) idxBuf[i] = start + i;
		// Sort uniquement la portion utile (Uint32Array.sort trie tout le tableau ;
		// on utilise un subarray pour limiter le tri à `count` éléments).
		idxBuf.subarray(0, count).sort((a, b) => sequence[a]! - sequence[b]!);

		for (let i = 0; i < count; i++) {
			const src = idxBuf[i]!;
			tmpStops[i] = stopRefs[src]!;
			tmpSeq[i] = sequence[src]!;
			tmpFlags[i] = flagsBitmask[src]!;
			tmpArr[i] = arrivalSecs[src]!;
			tmpDep[i] = departureSecs[src]!;
			tmpDist[i] = distanceTraveled[src]!;
		}
		for (let i = 0; i < count; i++) {
			stopRefs[start + i] = tmpStops[i]!;
			sequence[start + i] = tmpSeq[i]!;
			flagsBitmask[start + i] = tmpFlags[i]!;
			arrivalSecs[start + i] = tmpArr[i]!;
			departureSecs[start + i] = tmpDep[i]!;
			distanceTraveled[start + i] = tmpDist[i]!;
		}
	}

	// Calcul des distanceTraveled si demandé.
	if (computeShapeDistTraveled) {
		for (const trip of trips.values()) {
			const start = trip.stopTimeStart;
			const count = trip.stopTimeCount;
			if (count === 0) continue;

			const shapeRecalculated = !!trip.shape?.recalculatedDistances;

			let needs = shapeRecalculated;
			if (!needs) {
				for (let i = 0; i < count; i++) {
					if (Number.isNaN(distanceTraveled[start + i]!)) {
						needs = true;
						break;
					}
				}
			}
			if (!needs) continue;

			let currentDist = 0;
			for (let i = 0; i < count; i++) {
				const idx = start + i;
				const stop = stopRefs[idx]!;

				if (shapeRecalculated || Number.isNaN(distanceTraveled[idx]!)) {
					if (trip.shape !== undefined) {
						distanceTraveled[idx] = trip.shape.findClosestPointDistance(stop.latitude, stop.longitude);
					} else {
						if (i > 0) {
							const prev = stopRefs[idx - 1]!;
							currentDist += getDistance(prev.latitude, prev.longitude, stop.latitude, stop.longitude);
						}
						distanceTraveled[idx] = currentDist;
					}
				} else {
					currentDist = distanceTraveled[idx]!;
				}
			}
		}
	}

	// Pré-calcul des bornes first/last secs et drop des trips < 2 stops.
	for (const [id, trip] of trips) {
		const count = trip.stopTimeCount;
		if (count < 2) {
			trips.delete(id);
			continue;
		}
		const start = trip.stopTimeStart;
		trip.firstArrivalSecs = arrivalSecs[start]!;
		const lastIdx = start + count - 1;
		trip.lastArrivalSecs = arrivalSecs[lastIdx]!;
		trip.lastDepartureSecs = departureSecs[lastIdx]!;
	}

	// Finalise le store en mutant les champs (les Trip détiennent déjà la ref).
	placeholderStore.stops = stopRefs;
	placeholderStore.sequence = sequence;
	placeholderStore.flagsBitmask = flagsBitmask;
	placeholderStore.arrivalSecs = arrivalSecs;
	placeholderStore.departureSecs = departureSecs;
	placeholderStore.distanceTraveled = distanceTraveled;

	return { trips, stopTimeStore: placeholderStore };
}

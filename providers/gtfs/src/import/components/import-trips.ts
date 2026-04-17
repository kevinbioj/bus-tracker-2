import { join } from "node:path";

import { createPlainTime } from "../../cache/temporal-cache.js";
import type { Route } from "../../model/route.js";
import { Service } from "../../model/service.js";
import type { Shape } from "../../model/shape.js";
import type { Stop } from "../../model/stop.js";
import { StopTime } from "../../model/stop-time.js";
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

export async function importTrips(
	gtfsDirectory: string,
	{ filterTrips, mapTripId, mapRouteId, mapStopId, ignoreBlocks, computeShapeDistTraveled }: ImportGtfsOptions,
	routes: Map<string, Route>,
	services: Map<string, Service>,
	shapes: Map<string, Shape>,
	stops: Map<string, Stop>,
) {
	const trips = new Map<string, Trip>();
	const excludedTripIds = new Set<string>();

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
			[],
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

	await readCsv<StopTimeRecord>(join(gtfsDirectory, "stop_times.txt"), (stopTimeRecord) => {
		const tripId = mapTripId?.(stopTimeRecord.trip_id) ?? stopTimeRecord.trip_id;
		const stopId = mapStopId?.(stopTimeRecord.stop_id) ?? stopTimeRecord.stop_id;

		const trip = trips.get(tripId);
		if (trip === undefined) {
			if (excludedTripIds.has(tripId)) return;

			throw new Error(
				`Unknown trip with id '${tripId}' for {${stopTimeRecord.stop_sequence}/${stopId}/${stopTimeRecord.arrival_time}/${stopTimeRecord.departure_time}}.`,
			);
		}

		const stop = stops.get(stopId);
		if (stop === undefined) {
			throw new Error(
				`Unknown stop with id '${stopId}' for {${stopTimeRecord.stop_sequence}/${stopId}/${stopTimeRecord.arrival_time}/${stopTimeRecord.departure_time}}.`,
			);
		}

		const flagsBitmask = (stopTimeRecord.pickup_type === "1" ? 1 : 0) | (stopTimeRecord.drop_off_type === "1" ? 2 : 0);

		const [arrivalHours, arrivalMinutes, arrivalSeconds] = stopTimeRecord.arrival_time.split(":") as [
			string,
			string,
			string,
		];

		const [departureHours, departureMinutes, departureSeconds] = stopTimeRecord.departure_time.split(":") as [
			string,
			string,
			string,
		];

		const mismatchingTimes = stopTimeRecord.arrival_time !== stopTimeRecord.departure_time;

		const stopTime = new StopTime(
			+stopTimeRecord.stop_sequence,
			stop,
			flagsBitmask,
			createPlainTime(
				`${(+arrivalHours % 24).toString().padStart(2, "0")}:${arrivalMinutes.padStart(2, "0")}:${arrivalSeconds.padStart(2, "0")}`,
			),
			Math.floor(+arrivalHours / 24),
			mismatchingTimes
				? createPlainTime(
						`${(+departureHours % 24).toString().padStart(2, "0")}:${departureMinutes.padStart(2, "0")}:${departureSeconds.padStart(2, "0")}`,
					)
				: undefined,
			mismatchingTimes ? Math.floor(+departureHours / 24) : undefined,
			stopTimeRecord.shape_dist_traveled !== undefined ? +stopTimeRecord.shape_dist_traveled : undefined,
		);

		trip.stopTimes.push(stopTime);
	});

	for (const trip of trips.values()) {
		trip.stopTimes.sort((a, b) => a.sequence - b.sequence);

		const shapeRecalculated = !!trip.shape?.recalculatedDistances;

		if (
			computeShapeDistTraveled &&
			(shapeRecalculated || trip.stopTimes.some((st) => st.distanceTraveled === undefined))
		) {
			let currentDist = 0;
			for (let i = 0; i < trip.stopTimes.length; i++) {
				const stopTime = trip.stopTimes[i]!;

				if (shapeRecalculated || stopTime.distanceTraveled === undefined) {
					if (trip.shape !== undefined) {
						stopTime.distanceTraveled = trip.shape.findClosestPointDistance(
							stopTime.stop.latitude,
							stopTime.stop.longitude,
						);
					} else {
						if (i > 0) {
							const prevStopTime = trip.stopTimes[i - 1]!;
							currentDist += getDistance(
								prevStopTime.stop.latitude,
								prevStopTime.stop.longitude,
								stopTime.stop.latitude,
								stopTime.stop.longitude,
							);
						}
						stopTime.distanceTraveled = currentDist;
					}
				} else {
					currentDist = stopTime.distanceTraveled;
				}
			}
		}
	}

	return trips;
}

import { join } from "node:path";
import type { VehicleJourneyCallFlags } from "@bus-tracker/contracts";

import { createPlainTime } from "../../cache/temporal-cache.js";
import type { Route } from "../../model/route.js";
import type { Service } from "../../model/service.js";
import type { Shape } from "../../model/shape.js";
import type { Stop } from "../../model/stop.js";
import { StopTime } from "../../model/stop-time.js";
import { Trip } from "../../model/trip.js";
import { type CsvRecord, readCsv } from "../../utils/csv-reader.js";

import type { ImportGtfsOptions } from "../import-gtfs.js";

type TripRecord = CsvRecord<
	"trip_id" | "route_id" | "service_id" | "direction_id",
	"trip_headsign" | "block_id" | "shape_id"
>;
type StopTimeRecord = CsvRecord<
	"trip_id" | "arrival_time" | "departure_time" | "stop_sequence" | "stop_id",
	"shape_dist_traveled" | "pickup_type" | "drop_off_type"
>;

export async function importTrips(
	gtfsDirectory: string,
	{ filterTrips, mapTripId, mapRouteId, mapStopId, ignoreBlocks }: ImportGtfsOptions,
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
		if (typeof route === "undefined") {
			throw new Error(`Unknown route with id '${routeId}' for trip '${tripId}'.`);
		}

		const service = services.get(tripRecord.service_id);
		if (typeof service === "undefined") {
			throw new Error(`Unknown service with id '${tripRecord.service_id}' for trip '${tripId}'.`);
		}

		const trip = new Trip(
			tripId,
			route,
			service,
			[],
			+tripRecord.direction_id as 0 | 1,
			tripRecord.trip_headsign || undefined,
			typeof tripRecord.block_id !== "undefined" && tripRecord.block_id.length > 0 && !ignoreBlocks
				? tripRecord.block_id
				: undefined,
			typeof tripRecord.shape_id !== "undefined" ? shapes.get(tripRecord.shape_id) : undefined,
		);

		if (typeof filterTrips === "undefined" || filterTrips(trip)) {
			trips.set(trip.id, trip);
		} else {
			excludedTripIds.add(trip.id);
		}
	});

	await readCsv<StopTimeRecord>(join(gtfsDirectory, "stop_times.txt"), (stopTimeRecord) => {
		const tripId = mapTripId?.(stopTimeRecord.trip_id) ?? stopTimeRecord.trip_id;
		const stopId = mapStopId?.(stopTimeRecord.stop_id) ?? stopTimeRecord.stop_id;

		const trip = trips.get(tripId);
		if (typeof trip === "undefined") {
			if (excludedTripIds.has(tripId)) return;

			throw new Error(
				`Unknown trip with id '${tripId}' for {${stopTimeRecord.stop_sequence}/${stopId}/${stopTimeRecord.arrival_time}/${stopTimeRecord.departure_time}}.`,
			);
		}

		const stop = stops.get(stopId);
		if (typeof stop === "undefined") {
			throw new Error(
				`Unknown stop with id '${stopId}' for {${stopTimeRecord.stop_sequence}/${stopId}/${stopTimeRecord.arrival_time}/${stopTimeRecord.departure_time}}.`,
			);
		}

		const flags: VehicleJourneyCallFlags[] = [];
		if (stopTimeRecord.pickup_type === "1") flags.push("NO_PICKUP");
		if (stopTimeRecord.drop_off_type === "1") flags.push("NO_DROP_OFF");

		const arrivalHours = +stopTimeRecord.arrival_time.slice(0, 2);
		const departureHours = +stopTimeRecord.departure_time.slice(0, 2);

		const mismatchingTimes = stopTimeRecord.arrival_time !== stopTimeRecord.departure_time;

		const stopTime = new StopTime(
			+stopTimeRecord.stop_sequence,
			stop,
			flags,
			createPlainTime(`${(arrivalHours % 24).toString().padStart(2, "0")}:${stopTimeRecord.arrival_time.slice(3)}`),
			Math.floor(arrivalHours / 24),
			mismatchingTimes
				? createPlainTime(
						`${(departureHours % 24).toString().padStart(2, "0")}:${stopTimeRecord.departure_time.slice(3)}`,
					)
				: undefined,
			mismatchingTimes ? Math.floor(departureHours / 24) : undefined,
			typeof stopTimeRecord.shape_dist_traveled !== "undefined" ? +stopTimeRecord.shape_dist_traveled : undefined,
		);

		trip.stopTimes.push(stopTime);
	});

	for (const trip of trips.values()) {
		trip.stopTimes.sort((a, b) => a.sequence - b.sequence);
	}

	return trips;
}

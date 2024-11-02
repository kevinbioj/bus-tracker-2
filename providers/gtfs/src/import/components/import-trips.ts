import { join } from "node:path";
import { createPlainTime } from "../../cache/temporal-cache.js";
import type { Route } from "../../model/route.js";
import type { Service } from "../../model/service.js";
import type { Shape } from "../../model/shape.js";
import { StopTime } from "../../model/stop-time.js";
import type { Stop } from "../../model/stop.js";
import { Trip } from "../../model/trip.js";
import { type CsvRecord, readCsv } from "../../utils/csv-reader.js";
import type { ImportGtfsOptions } from "../import-gtfs.js";

type TripRecord = CsvRecord<
	"trip_id" | "route_id" | "service_id" | "direction_id",
	"trip_headsign" | "block_id" | "shape_id"
>;
type StopTimeRecord = CsvRecord<
	"trip_id" | "arrival_time" | "departure_time" | "stop_sequence" | "stop_id",
	"shape_dist_traveled"
>;

export async function importTrips(
	gtfsDirectory: string,
	{ filterTrips }: ImportGtfsOptions,
	routes: Map<string, Route>,
	services: Map<string, Service>,
	shapes: Map<string, Shape>,
	stops: Map<string, Stop>,
) {
	const trips = new Map<string, Trip>();
	const excludedTripIds = new Set<string>();

	await readCsv<TripRecord>(join(gtfsDirectory, "trips.txt"), (tripRecord) => {
		const route = routes.get(tripRecord.route_id);
		if (typeof route === "undefined") {
			throw new Error(`Unknown route with id '${tripRecord.route_id}' for trip '${tripRecord.trip_id}'.`);
		}

		const service = services.get(tripRecord.service_id);
		if (typeof service === "undefined") {
			throw new Error(`Unknown service with id '${tripRecord.service_id}' for trip '${tripRecord.trip_id}'.`);
		}

		const trip = new Trip(
			tripRecord.trip_id,
			route,
			service,
			[],
			+tripRecord.direction_id as 0 | 1,
			tripRecord.trip_headsign || undefined,
			tripRecord.block_id || undefined,
			typeof tripRecord.shape_id !== "undefined" ? shapes.get(tripRecord.shape_id) : undefined,
		);

		if (typeof filterTrips === "undefined" || filterTrips(trip)) {
			trips.set(trip.id, trip);
		} else {
			excludedTripIds.add(trip.id);
		}
	});

	await readCsv<StopTimeRecord>(join(gtfsDirectory, "stop_times.txt"), (stopTimeRecord) => {
		const trip = trips.get(stopTimeRecord.trip_id);
		if (typeof trip === "undefined") {
			if (excludedTripIds.has(stopTimeRecord.trip_id)) return;

			throw new Error(
				`Unknown trip with id '${stopTimeRecord.trip_id}' for {${stopTimeRecord.stop_sequence}/${stopTimeRecord.stop_id}/${stopTimeRecord.arrival_time}/${stopTimeRecord.departure_time}}.`,
			);
		}

		const stop = stops.get(stopTimeRecord.stop_id);
		if (typeof stop === "undefined") {
			throw new Error(
				`Unknown stop with id '${stopTimeRecord.stop_id}' for {${stopTimeRecord.stop_sequence}/${stopTimeRecord.stop_id}/${stopTimeRecord.arrival_time}/${stopTimeRecord.departure_time}}.`,
			);
		}

		const arrivalHours = +stopTimeRecord.arrival_time.slice(0, 2);
		const departureHours = +stopTimeRecord.departure_time.slice(0, 2);

		const mismatchingTimes = stopTimeRecord.arrival_time !== stopTimeRecord.departure_time;

		const stopTime = new StopTime(
			+stopTimeRecord.stop_sequence,
			stop,
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

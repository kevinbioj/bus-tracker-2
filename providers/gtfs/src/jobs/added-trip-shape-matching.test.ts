import { describe, expect, it } from "vitest";
import { Agency } from "../model/agency.js";
import type { Gtfs } from "../model/gtfs.js";
import type { TripUpdate } from "../model/gtfs-rt.js";
import { Route } from "../model/route.js";
import { Service } from "../model/service.js";
import { Shape } from "../model/shape.js";
import { Stop } from "../model/stop.js";
import { StopTimeStore } from "../model/stop-time-store.js";
import { Trip } from "../model/trip.js";
import {
	createCallsFromTripUpdate,
	findAddedTripShapeMatch,
	findAddedTripShapeMatchWithFallback,
	guessPositionFromCalls,
} from "./added-trip-shape-matching.js";

function epochSeconds(value: string) {
	return Math.floor(Temporal.Instant.from(value).epochMilliseconds / 1000);
}

function makeShape() {
	return new Shape("shape:original", new Float64Array([0, 0, 0, 0, 0.01, 1000, 0, 0.02, 2000, 0, 0.03, 3000]));
}

function makeFallbackShape() {
	return new Shape("shape:fallback", new Float64Array([0, 0, 0, 0, 0.01, 10, 0, 0.02, 20, 0, 0.03, 30]));
}

function makeGtfs() {
	const agency = new Agency("agency", "Agency", "UTC");
	const route = new Route("line:1", agency, "1", "BUS");
	const otherRoute = new Route("line:2", agency, "2", "BUS");
	const service = new Service("service", [true, true, true, true, true, true, true]);
	const shape = makeShape();
	const stops = [
		new Stop("A", "A", 0, 0),
		new Stop("B", "B", 0, 0.01),
		new Stop("C", "C", 0, 0.02),
		new Stop("D", "D", 0, 0.03),
		new Stop("X", "Diversion", 0.01, 0.01),
	];
	const store = new StopTimeStore(
		stops,
		new Uint8Array([1, 2, 3, 4]),
		new Uint8Array([0, 0, 0, 0]),
		new Uint32Array([8 * 3600, 8 * 3600 + 10 * 60, 8 * 3600 + 20 * 60, 8 * 3600 + 30 * 60]),
		new Uint32Array([8 * 3600, 8 * 3600 + 10 * 60, 8 * 3600 + 20 * 60, 8 * 3600 + 30 * 60]),
		new Float32Array([0, 1000, 2000, 3000]),
		new Uint32Array([0]),
		new Uint32Array([4]),
		new Uint32Array([8 * 3600]),
		new Uint32Array([8 * 3600 + 30 * 60]),
		new Uint32Array([8 * 3600 + 30 * 60]),
	);
	const trip = new Trip(0, "original", route, service, store, 0, "Terminus", undefined, shape);
	const gtfs: Gtfs = {
		routes: new Map([
			[route.id, route],
			[otherRoute.id, otherRoute],
		]),
		stops: new Map(stops.map((stop) => [stop.id, stop])),
		trips: new Map([[trip.id, trip]]),
		journeys: new Map(),
		stopTimeStore: store,
		importedAt: Temporal.Instant.from("2026-05-18T00:00:00Z"),
		lastModified: null,
		etag: null,
	};

	return { gtfs, route, trip };
}

function addedTripUpdate(routeId = "line:1", directionId: number | undefined = 0): TripUpdate {
	return {
		timestamp: epochSeconds("2026-05-18T08:00:00Z"),
		trip: {
			tripId: "added",
			routeId,
			...(directionId !== undefined ? { directionId } : {}),
			startDate: "2026-05-18",
			scheduleRelationship: "ADDED",
		},
		stopTimeUpdate: [
			{ stopId: "A", stopSequence: 1, departure: { time: epochSeconds("2026-05-18T08:00:30Z") } },
			{ stopId: "C", stopSequence: 2, arrival: { time: epochSeconds("2026-05-18T08:20:30Z") } },
			{ stopId: "D", stopSequence: 3, arrival: { time: epochSeconds("2026-05-18T08:30:30Z") } },
		],
	};
}

describe("findAddedTripShapeMatch", () => {
	it("matches an ADDED trip to a static trip with the same route, date and ordered close stop times", () => {
		const { gtfs, trip } = makeGtfs();
		const tripUpdate = addedTripUpdate();
		const addedCalls = createCallsFromTripUpdate(gtfs, tripUpdate)!;
		const result = findAddedTripShapeMatch(tripUpdate, addedCalls, Temporal.PlainDate.from("2026-05-18"), [
			{
				date: Temporal.PlainDate.from("2026-05-18"),
				trip,
				calls: trip.getScheduledJourney(Temporal.PlainDate.from("2026-05-18"), true).calls,
			},
		]);

		expect(result?.candidate.trip.id).toBe("original");
		expect(result?.calls.map((call) => call.distanceTraveled)).toEqual([0, 2000, 3000]);
	});

	it("does not match when the route is different", () => {
		const { gtfs, trip } = makeGtfs();
		const staticCandidate = {
			date: Temporal.PlainDate.from("2026-05-18"),
			trip,
			calls: trip.getScheduledJourney(Temporal.PlainDate.from("2026-05-18"), true).calls,
		};

		const tripUpdate = addedTripUpdate("line:2", 0);
		const addedCalls = createCallsFromTripUpdate(gtfs, tripUpdate)!;

		expect(
			findAddedTripShapeMatch(tripUpdate, addedCalls, Temporal.PlainDate.from("2026-05-18"), [staticCandidate]),
		).toBeUndefined();
	});

	it("ignores direction_id and matches the candidate with the same stop order", () => {
		const { gtfs, trip } = makeGtfs();
		const date = Temporal.PlainDate.from("2026-05-18");
		const reverseStops = ["D", "C", "A"].map((stopId) => gtfs.stops.get(stopId)!);
		const reverseStore = new StopTimeStore(
			reverseStops,
			new Uint8Array([1, 2, 3]),
			new Uint8Array([0, 0, 0]),
			new Uint32Array([8 * 3600, 8 * 3600 + 10 * 60, 8 * 3600 + 30 * 60]),
			new Uint32Array([8 * 3600, 8 * 3600 + 10 * 60, 8 * 3600 + 30 * 60]),
			new Float32Array([3000, 2000, 0]),
			new Uint32Array([0]),
			new Uint32Array([3]),
			new Uint32Array([8 * 3600]),
			new Uint32Array([8 * 3600 + 30 * 60]),
			new Uint32Array([8 * 3600 + 30 * 60]),
		);
		const reverseTrip = new Trip(
			0,
			"reverse",
			trip.route,
			trip.service,
			reverseStore,
			1,
			"Reverse",
			undefined,
			trip.shape,
		);
		const tripUpdate = addedTripUpdate("line:1", undefined);
		tripUpdate.stopTimeUpdate = [
			{ stopId: "D", stopSequence: 1, departure: { time: epochSeconds("2026-05-18T08:00:30Z") } },
			{ stopId: "C", stopSequence: 2, arrival: { time: epochSeconds("2026-05-18T08:10:30Z") } },
			{ stopId: "A", stopSequence: 3, arrival: { time: epochSeconds("2026-05-18T08:30:30Z") } },
		];
		const addedCalls = createCallsFromTripUpdate(gtfs, tripUpdate)!;

		const result = findAddedTripShapeMatch(tripUpdate, addedCalls, date, [
			{ date, trip, calls: trip.getScheduledJourney(date, true).calls },
			{ date, trip: reverseTrip, calls: reverseTrip.getScheduledJourney(date, true).calls },
		]);

		expect(result?.candidate.trip.id).toBe("reverse");
		expect(result?.candidate.trip.direction).toBe(1);
		expect(result?.calls.map((call) => call.distanceTraveled)).toEqual([3000, 2000, 0]);
	});

	it("does not match when stop times exceed the configured tolerance", () => {
		const { gtfs, trip } = makeGtfs();
		const tripUpdate = addedTripUpdate();
		tripUpdate.stopTimeUpdate![0]!.departure = { time: epochSeconds("2026-05-18T09:00:00Z") };
		tripUpdate.stopTimeUpdate![1]!.arrival = { time: epochSeconds("2026-05-18T09:20:00Z") };
		tripUpdate.stopTimeUpdate![2]!.arrival = { time: epochSeconds("2026-05-18T09:30:00Z") };
		const addedCalls = createCallsFromTripUpdate(gtfs, tripUpdate)!;

		expect(
			findAddedTripShapeMatch(tripUpdate, addedCalls, Temporal.PlainDate.from("2026-05-18"), [
				{
					date: Temporal.PlainDate.from("2026-05-18"),
					trip,
					calls: trip.getScheduledJourney(Temporal.PlainDate.from("2026-05-18"), true).calls,
				},
			]),
		).toBeUndefined();
	});

	it("can match a scheduled static trip when no canceled candidates are supplied", () => {
		const { gtfs, trip } = makeGtfs();
		const tripUpdate = addedTripUpdate();
		const addedCalls = createCallsFromTripUpdate(gtfs, tripUpdate)!;

		const result = findAddedTripShapeMatch(tripUpdate, addedCalls, Temporal.PlainDate.from("2026-05-18"), [
			{
				date: Temporal.PlainDate.from("2026-05-18"),
				trip,
				calls: trip.getScheduledJourney(Temporal.PlainDate.from("2026-05-18"), true).calls,
			},
		]);

		expect(result?.candidate.trip.id).toBe("original");
	});

	it("can match when a terminal stop is removed from the ADDED trip", () => {
		const { gtfs, trip } = makeGtfs();
		const tripUpdate = addedTripUpdate();
		tripUpdate.stopTimeUpdate = tripUpdate.stopTimeUpdate!.slice(1);
		const addedCalls = createCallsFromTripUpdate(gtfs, tripUpdate)!;

		const result = findAddedTripShapeMatch(tripUpdate, addedCalls, Temporal.PlainDate.from("2026-05-18"), [
			{
				date: Temporal.PlainDate.from("2026-05-18"),
				trip,
				calls: trip.getScheduledJourney(Temporal.PlainDate.from("2026-05-18"), true).calls,
			},
		]);

		expect(result?.candidate.trip.id).toBe("original");
		expect(result?.calls.map((call) => call.distanceTraveled)).toEqual([2000, 3000]);
	});

	it("does not match when an ADDED known stop is absent from the static candidate", () => {
		const { gtfs, trip } = makeGtfs();
		const tripUpdate = addedTripUpdate();
		tripUpdate.stopTimeUpdate!.splice(1, 0, {
			stopId: "X",
			stopSequence: 2,
			arrival: { time: epochSeconds("2026-05-18T08:10:00Z") },
		});
		const addedCalls = createCallsFromTripUpdate(gtfs, tripUpdate)!;

		const result = findAddedTripShapeMatch(tripUpdate, addedCalls, Temporal.PlainDate.from("2026-05-18"), [
			{
				date: Temporal.PlainDate.from("2026-05-18"),
				trip,
				calls: trip.getScheduledJourney(Temporal.PlainDate.from("2026-05-18"), true).calls,
			},
		]);

		expect(result).toBeUndefined();
	});

	it("does not use a partial opposite-direction match when a terminal is replaced", () => {
		const { gtfs, trip } = makeGtfs();
		const date = Temporal.PlainDate.from("2026-05-18");
		const reverseStops = ["D", "C", "B", "A"].map((stopId) => gtfs.stops.get(stopId)!);
		const reverseStore = new StopTimeStore(
			reverseStops,
			new Uint8Array([1, 2, 3, 4]),
			new Uint8Array([0, 0, 0, 0]),
			new Uint32Array([8 * 3600, 8 * 3600 + 10 * 60, 8 * 3600 + 20 * 60, 8 * 3600 + 30 * 60]),
			new Uint32Array([8 * 3600, 8 * 3600 + 10 * 60, 8 * 3600 + 20 * 60, 8 * 3600 + 30 * 60]),
			new Float32Array([3000, 2000, 1000, 0]),
			new Uint32Array([0]),
			new Uint32Array([4]),
			new Uint32Array([8 * 3600]),
			new Uint32Array([8 * 3600 + 30 * 60]),
			new Uint32Array([8 * 3600 + 30 * 60]),
		);
		const reverseTrip = new Trip(
			0,
			"reverse",
			trip.route,
			trip.service,
			reverseStore,
			1,
			"Reverse",
			undefined,
			trip.shape,
		);
		const tripUpdate = addedTripUpdate("line:1", undefined);
		tripUpdate.stopTimeUpdate = [
			{ stopId: "X", stopSequence: 1, departure: { time: epochSeconds("2026-05-18T08:00:30Z") } },
			{ stopId: "C", stopSequence: 2, arrival: { time: epochSeconds("2026-05-18T08:10:30Z") } },
			{ stopId: "D", stopSequence: 3, arrival: { time: epochSeconds("2026-05-18T08:20:30Z") } },
		];
		const addedCalls = createCallsFromTripUpdate(gtfs, tripUpdate)!;

		const result = findAddedTripShapeMatch(tripUpdate, addedCalls, date, [
			{ date, trip, calls: trip.getScheduledJourney(date, true).calls },
			{ date, trip: reverseTrip, calls: reverseTrip.getScheduledJourney(date, true).calls },
		]);

		expect(result).toBeUndefined();
	});

	it("ignores unknown stops in ADDED trip updates", () => {
		const { gtfs } = makeGtfs();
		const tripUpdate = addedTripUpdate();
		tripUpdate.stopTimeUpdate!.splice(1, 0, {
			stopId: "unknown-diversion-stop",
			stopSequence: 2,
			arrival: { time: epochSeconds("2026-05-18T08:10:00Z") },
		});

		const calls = createCallsFromTripUpdate(gtfs, tripUpdate);

		expect(calls?.map((call) => call.stop.id)).toEqual(["A", "C", "D"]);
	});

	it("does not create calls when all ADDED trip stops are unknown", () => {
		const { gtfs } = makeGtfs();
		const tripUpdate = addedTripUpdate();
		tripUpdate.stopTimeUpdate = [
			{ stopId: "unknown-a", stopSequence: 1, departure: { time: epochSeconds("2026-05-18T08:00:00Z") } },
			{ stopId: "unknown-b", stopSequence: 2, arrival: { time: epochSeconds("2026-05-18T08:10:00Z") } },
		];

		expect(createCallsFromTripUpdate(gtfs, tripUpdate)).toBeUndefined();
	});

	it("prefers priority candidates over fallback candidates", () => {
		const { gtfs, trip } = makeGtfs();
		const fallbackTrip = new Trip(
			0,
			"fallback",
			trip.route,
			trip.service,
			trip.store,
			trip.direction,
			trip.headsign,
			undefined,
			makeFallbackShape(),
		);
		const date = Temporal.PlainDate.from("2026-05-18");
		const tripUpdate = addedTripUpdate();
		const addedCalls = createCallsFromTripUpdate(gtfs, tripUpdate)!;
		const priorityCandidate = { date, trip, calls: trip.getScheduledJourney(date, true).calls };
		const fallbackCandidate = { date, trip: fallbackTrip, calls: fallbackTrip.getScheduledJourney(date, true).calls };

		const result = findAddedTripShapeMatchWithFallback(
			tripUpdate,
			addedCalls,
			date,
			[priorityCandidate],
			[fallbackCandidate],
		);

		expect(result?.candidate.trip.id).toBe("original");
		expect(result?.calls.map((call) => call.distanceTraveled)).toEqual([0, 2000, 3000]);
	});
});

describe("guessPositionFromCalls", () => {
	it("interpolates an ADDED trip position along the matched original shape", () => {
		const { gtfs, trip } = makeGtfs();
		const tripUpdate = addedTripUpdate();
		const addedCalls = createCallsFromTripUpdate(gtfs, tripUpdate)!;
		const result = findAddedTripShapeMatch(tripUpdate, addedCalls, Temporal.PlainDate.from("2026-05-18"), [
			{
				date: Temporal.PlainDate.from("2026-05-18"),
				trip,
				calls: trip.getScheduledJourney(Temporal.PlainDate.from("2026-05-18"), true).calls,
			},
		])!;

		const position = guessPositionFromCalls(
			result.calls.slice(0, 2),
			trip.shape!,
			Temporal.Instant.from("2026-05-18T08:10:30Z"),
			"UTC",
		);

		expect(position?.type).toBe("COMPUTED");
		expect(position?.atStop).toBe(false);
		expect(position?.distanceTraveled).toBe(1000);
		expect(position?.latitude).toBe(0);
		expect(position?.longitude).toBe(0.01);
	});

	it("does not use diversion stops for interpolated positions", () => {
		const { gtfs, trip } = makeGtfs();
		const tripUpdate = addedTripUpdate();
		tripUpdate.stopTimeUpdate!.splice(1, 0, {
			stopId: "X",
			stopSequence: 2,
			arrival: { time: epochSeconds("2026-05-18T08:10:00Z") },
		});
		const calls = createCallsFromTripUpdate(gtfs, tripUpdate)!.map((call) => ({
			...call,
			distanceTraveled: call.stop.id === "A" ? 0 : call.stop.id === "C" ? 2000 : call.stop.id === "D" ? 3000 : undefined,
		}));

		const position = guessPositionFromCalls(
			calls,
			trip.shape!,
			Temporal.Instant.from("2026-05-18T08:10:30Z"),
			"UTC",
		);

		expect(position?.type).toBe("COMPUTED");
		expect(position?.atStop).toBe(false);
		expect(position?.latitude).toBe(0);
		expect(position?.longitude).toBe(0.01);
	});
});

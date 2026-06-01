import { describe, expect, it } from "vitest";

import { Agency } from "./agency.js";
import type { Gtfs } from "./gtfs.js";
import { Route } from "./route.js";
import { Service } from "./service.js";
import { Stop } from "./stop.js";
import { StopTimeStore } from "./stop-time-store.js";
import { Trip } from "./trip.js";

function makeGtfs() {
	const agency = new Agency("agency", "Agency", "UTC");
	const route = new Route("route", agency, "1", "BUS");
	const service = new Service("service");
	const stops = [
		new Stop("A", "A", 0, 0, "1"),
		new Stop("B", "B", 0, 0.01, "2"),
		new Stop("X", "Replacement", 0.01, 0.01, "3"),
	];
	const store = new StopTimeStore(
		stops.slice(0, 2),
		new Uint8Array([1, 2]),
		new Uint8Array([0, 0]),
		new Uint32Array([8 * 3600, 8 * 3600 + 10 * 60]),
		new Uint32Array([8 * 3600, 8 * 3600 + 10 * 60]),
		new Float32Array([0, 1000]),
		new Uint32Array([0]),
		new Uint32Array([2]),
		new Uint32Array([8 * 3600]),
		new Uint32Array([8 * 3600 + 10 * 60]),
		new Uint32Array([8 * 3600 + 10 * 60]),
	);
	const trip = new Trip(0, "trip", route, service, store, 0);
	const gtfs: Gtfs = {
		routes: new Map([[route.id, route]]),
		stops: new Map(stops.map((stop) => [stop.id, stop])),
		trips: new Map([[trip.id, trip]]),
		journeys: new Map(),
		stopTimeStore: store,
		importedAt: Temporal.Instant.from("2026-06-01T00:00:00Z"),
		lastModified: null,
		etag: null,
	};

	return { gtfs, trip };
}

describe("Journey", () => {
	it("uses scheduled stop platforms and lets GTFS-RT assigned stops override them", () => {
		const { gtfs, trip } = makeGtfs();
		const journey = trip.getScheduledJourney(Temporal.PlainDate.from("2026-06-01"), true);

		expect(journey.calls.map((call) => call.platform)).toEqual(["1", "2"]);

		journey.updateJourney(gtfs, [
			{
				stopId: "A",
				stopSequence: 1,
				stopTimeProperties: { assignedStopId: "X" },
			},
		]);

		expect(journey.calls.map((call) => call.platform)).toEqual(["3", "2"]);

		journey.updateJourney(gtfs, []);

		expect(journey.calls.map((call) => call.platform)).toEqual(["1", "2"]);
	});
});

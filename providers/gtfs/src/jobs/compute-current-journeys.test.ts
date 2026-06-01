import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { downloadGtfsRt } from "../download/download-gtfs-rt.js";
import { Agency } from "../model/agency.js";
import type { Gtfs } from "../model/gtfs.js";
import type { TripUpdate } from "../model/gtfs-rt.js";
import { Route } from "../model/route.js";
import { Service } from "../model/service.js";
import { Shape } from "../model/shape.js";
import { Source } from "../model/source.js";
import { Stop } from "../model/stop.js";
import { StopTimeStore } from "../model/stop-time-store.js";
import { Trip } from "../model/trip.js";
import { computeVehicleJourneys } from "./compute-current-journeys.js";

vi.mock("../download/download-gtfs-rt.js", () => ({
	downloadGtfsRt: vi.fn(),
}));

type DraftConsole = Console & {
	draft?: (...args: unknown[]) => (...args: unknown[]) => void;
};

function epochSeconds(value: string) {
	return Math.floor(Temporal.Instant.from(value).epochMilliseconds / 1000);
}

function makeGtfs() {
	const agency = new Agency("agency", "Agency", "UTC");
	const route = new Route("line:1", agency, "1", "BUS");
	const service = new Service("service", [true, true, true, true, true, true, true]);
	const shape = new Shape("shape:original", new Float64Array([0, 0, 0, 0, 0.01, 1000, 0, 0.02, 2000]));
	const stops = [
		new Stop("A", "A", 0, 0, "1"),
		new Stop("B", "B", 0, 0.01, "2"),
		new Stop("C", "C", 0, 0.02, "3"),
		new Stop("X", "Replacement", 0.01, 0.01, "4"),
	];
	const store = new StopTimeStore(
		stops.slice(0, 3),
		new Uint8Array([1, 2, 3]),
		new Uint8Array([0, 0, 0]),
		new Uint32Array([8 * 3600, 8 * 3600 + 10 * 60, 8 * 3600 + 20 * 60]),
		new Uint32Array([8 * 3600, 8 * 3600 + 10 * 60, 8 * 3600 + 20 * 60]),
		new Float32Array([0, 1000, 2000]),
		new Uint32Array([0]),
		new Uint32Array([3]),
		new Uint32Array([8 * 3600]),
		new Uint32Array([8 * 3600 + 20 * 60]),
		new Uint32Array([8 * 3600 + 20 * 60]),
	);
	const trip = new Trip(0, "original", route, service, store, 0, "Terminus", undefined, shape);
	const gtfs: Gtfs = {
		routes: new Map([[route.id, route]]),
		stops: new Map(stops.map((stop) => [stop.id, stop])),
		trips: new Map([[trip.id, trip]]),
		journeys: new Map(),
		stopTimeStore: store,
		importedAt: Temporal.Instant.from("2026-05-18T00:00:00Z"),
		lastModified: null,
		etag: null,
	};

	return gtfs;
}

function unmatchedAddedTripUpdate(): TripUpdate {
	return {
		timestamp: epochSeconds("2026-05-18T08:00:00Z"),
		trip: {
			tripId: "added",
			routeId: "line:1",
			startDate: "2026-05-18",
			scheduleRelationship: "ADDED",
		},
		vehicle: { id: "vehicle:1" },
		stopTimeUpdate: [
			{ stopId: "A", stopSequence: 1, departure: { time: epochSeconds("2026-05-18T08:00:00Z") } },
			{ stopId: "X", stopSequence: 2, arrival: { time: epochSeconds("2026-05-18T08:10:00Z") } },
			{ stopId: "C", stopSequence: 3, arrival: { time: epochSeconds("2026-05-18T08:20:00Z") } },
		],
	};
}

describe("computeVehicleJourneys", () => {
	beforeEach(() => {
		vi.spyOn(Temporal.Now, "instant").mockReturnValue(Temporal.Instant.from("2026-05-18T08:12:00Z"));
		(console as DraftConsole).draft = vi.fn(() => vi.fn());
	});

	afterEach(() => {
		vi.restoreAllMocks();
		Reflect.deleteProperty(console, "draft");
	});

	it("emits an unmatched ADDED trip without path and positions it at the last passed stop", async () => {
		vi.mocked(downloadGtfsRt).mockResolvedValue({
			tripUpdates: [unmatchedAddedTripUpdate()],
			vehiclePositions: [],
		});
		const source = new Source("test", {
			staticResourceHref: "https://example.com/gtfs.zip",
			addedTripShapeMatching: true,
			getNetworkRef: () => "network",
		});
		source.gtfs = makeGtfs();

		const { journeys, paths } = await computeVehicleJourneys(source);

		expect(paths).toEqual({});
		expect(journeys).toHaveLength(1);
		expect(journeys[0]).toMatchObject({
			id: "network::VehicleTracking:vehicle:1",
			position: {
				latitude: 0.01,
				longitude: 0.01,
				atStop: true,
				type: "COMPUTED",
			},
			line: {
				ref: "network:Line:line:1",
				number: "1",
				type: "BUS",
			},
		});
		expect(journeys[0]?.pathRef).toBeUndefined();
		expect(journeys[0]?.journeyRef).toBeUndefined();
		expect(journeys[0]?.direction).toBeUndefined();
		expect(journeys[0]?.calls?.map((call) => call.stopName)).toEqual(["C"]);
		expect(journeys[0]?.calls?.map((call) => call.platformName)).toEqual(["3"]);
		expect(journeys[0]?.calls?.some((call) => call.distanceTraveled !== undefined)).toBe(false);
	});

	it("emits scheduled stop platforms on realtime vehicle position journeys", async () => {
		vi.mocked(downloadGtfsRt).mockResolvedValue({
			tripUpdates: [],
			vehiclePositions: [
				{
					timestamp: epochSeconds("2026-05-18T08:12:00Z"),
					trip: {
						tripId: "original",
						routeId: "line:1",
						startDate: "2026-05-18",
					},
					vehicle: { id: "vehicle:1" },
					position: { latitude: 0, longitude: 0.01 },
					currentStopSequence: 2,
				},
			],
		});
		const source = new Source("test", {
			staticResourceHref: "https://example.com/gtfs.zip",
			getNetworkRef: () => "network",
		});
		source.gtfs = makeGtfs();

		const { journeys } = await computeVehicleJourneys(source);

		expect(journeys).toHaveLength(1);
		expect(journeys[0]?.calls?.map((call) => call.stopName)).toEqual(["B", "C"]);
		expect(journeys[0]?.calls?.map((call) => call.platformName)).toEqual(["2", "3"]);
	});
});

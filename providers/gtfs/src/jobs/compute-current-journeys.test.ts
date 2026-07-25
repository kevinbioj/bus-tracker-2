import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { downloadGtfsRt } from "../download/download-gtfs-rt.js";
import { Agency } from "../model/agency.js";
import type { Gtfs } from "../model/gtfs.js";
import type { TripUpdate, VehiclePosition } from "../model/gtfs-rt.js";
import { Route } from "../model/route.js";
import { Service } from "../model/service.js";
import { Shape } from "../model/shape.js";
import { Source, type SourceOptions } from "../model/source.js";
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

function delayedTripUpdate(delaySeconds: number): TripUpdate {
	return {
		timestamp: epochSeconds("2026-05-18T08:05:00Z"),
		trip: {
			tripId: "original",
			routeId: "line:1",
			startDate: "2026-05-18",
		},
		vehicle: { id: "vehicle:1" },
		stopTimeUpdate: [
			{
				stopId: "B",
				stopSequence: 2,
				arrival: { delay: delaySeconds },
				departure: { delay: delaySeconds },
			},
		],
	};
}

const DATE = Temporal.PlainDate.from("2026-05-18");

function makeSource(options?: Partial<SourceOptions>) {
	return new Source("test", {
		staticResourceHref: "https://example.com/gtfs.zip",
		getNetworkRef: () => "network",
		...options,
	});
}

/** Source dont la course théorique `original` (A 8:00 → B 8:10 → C 8:20) est déjà pré-calculée. */
function scheduledSource(options?: Partial<SourceOptions>) {
	const source = makeSource(options);
	source.gtfs = makeGtfs();
	const trip = source.gtfs.trips.get("original")!;
	source.gtfs.journeys.set(`${DATE}-original`, trip.getScheduledJourney(DATE, true));
	return source;
}

/** Un cycle de calcul à l'heure donnée, sans donnée temps réel sauf indication contraire. */
async function cycleAt(source: Source, time: string, realtime?: { vehiclePositions?: VehiclePosition[] }) {
	vi.spyOn(Temporal.Now, "instant").mockReturnValue(Temporal.Instant.from(`2026-05-18T${time}Z`));
	vi.mocked(downloadGtfsRt).mockResolvedValue({
		tripUpdates: [],
		vehiclePositions: realtime?.vehiclePositions ?? [],
	});
	return computeVehicleJourneys(source);
}

/**
 * Deux courses d'un même roulement, sans descripteur véhicule : elles partagent donc la clé de
 * publication `ServiceBlock`. Ordre d'insertion défavorable — la course qui se termine d'abord.
 *
 * t1 : A 8:00 → B 8:10 → C 8:20   |   t2 : C 8:22 → B 8:32 → A 8:42
 */
function blockSource(options?: Partial<SourceOptions>) {
	const agency = new Agency("agency", "Agency", "UTC");
	const route = new Route("line:1", agency, "1", "BUS");
	const service = new Service("service", [true, true, true, true, true, true, true]);
	const shape = new Shape("shape", new Float64Array([0, 0, 0, 0, 0.01, 1000, 0, 0.02, 2000]));
	const stops = [new Stop("A", "A", 0, 0), new Stop("B", "B", 0, 0.01), new Stop("C", "C", 0, 0.02)];
	const times = [
		8 * 3600,
		8 * 3600 + 10 * 60,
		8 * 3600 + 20 * 60,
		8 * 3600 + 22 * 60,
		8 * 3600 + 32 * 60,
		8 * 3600 + 42 * 60,
	];
	const store = new StopTimeStore(
		[stops[0]!, stops[1]!, stops[2]!, stops[2]!, stops[1]!, stops[0]!],
		new Uint8Array([1, 2, 3, 1, 2, 3]),
		new Uint8Array([0, 0, 0, 0, 0, 0]),
		new Uint32Array(times),
		new Uint32Array(times),
		new Float32Array([0, 1000, 2000, 0, 1000, 2000]),
		new Uint32Array([0, 3]),
		new Uint32Array([3, 3]),
		new Uint32Array([times[0]!, times[3]!]),
		new Uint32Array([times[2]!, times[5]!]),
		new Uint32Array([times[2]!, times[5]!]),
	);
	const t1 = new Trip(0, "t1", route, service, store, 0, "Terminus C", "block:1", shape);
	const t2 = new Trip(1, "t2", route, service, store, 1, "Terminus A", "block:1", shape);

	const source = makeSource(options);
	source.gtfs = {
		routes: new Map([[route.id, route]]),
		stops: new Map(stops.map((stop) => [stop.id, stop])),
		trips: new Map([
			[t1.id, t1],
			[t2.id, t2],
		]),
		journeys: new Map([
			[`${DATE}-t1`, t1.getScheduledJourney(DATE, true)],
			[`${DATE}-t2`, t2.getScheduledJourney(DATE, true)],
		]),
		stopTimeStore: store,
		importedAt: Temporal.Instant.from("2026-05-18T00:00:00Z"),
		lastModified: null,
		etag: null,
	};
	return source;
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

	it("does not let a journey move backwards between two cycles when its delay increases", async () => {
		const source = new Source("test", {
			staticResourceHref: "https://example.com/gtfs.zip",
			getNetworkRef: () => "network",
		});
		source.gtfs = makeGtfs();

		vi.spyOn(Temporal.Now, "instant").mockReturnValue(Temporal.Instant.from("2026-05-18T08:05:00Z"));
		vi.mocked(downloadGtfsRt).mockResolvedValue({ tripUpdates: [delayedTripUpdate(2 * 60)], vehiclePositions: [] });
		const first = await computeVehicleJourneys(source);

		vi.spyOn(Temporal.Now, "instant").mockReturnValue(Temporal.Instant.from("2026-05-18T08:05:30Z"));
		vi.mocked(downloadGtfsRt).mockResolvedValue({ tripUpdates: [delayedTripUpdate(5 * 60)], vehiclePositions: [] });
		const second = await computeVehicleJourneys(source);

		const firstDistance = first.journeys[0]?.position.distanceTraveled;
		expect(firstDistance).toBeCloseTo(416.67, 1);
		// Sans guard, le retard passé de 2 à 5 min ferait retomber la position à ~367 m.
		expect(second.journeys[0]?.position.distanceTraveled).toBe(firstDistance);
	});
});

describe("computeVehicleJourneys (arrivée au terminus)", () => {
	beforeEach(() => {
		vi.spyOn(Temporal.Now, "instant").mockReturnValue(Temporal.Instant.from("2026-05-18T08:12:00Z"));
		(console as DraftConsole).draft = vi.fn(() => vi.fn());
	});

	afterEach(() => {
		vi.restoreAllMocks();
		Reflect.deleteProperty(console, "draft");
	});

	it("publie une dernière fois la course qui vient d'atteindre son terminus", async () => {
		const source = scheduledSource();

		const before = await cycleAt(source, "08:19:45");
		expect(before.journeys).toHaveLength(1);
		expect(before.journeys[0]?.position).toMatchObject({ atStop: false, distanceTraveled: 1975 });

		const final = await cycleAt(source, "08:20:15");
		expect(final.journeys).toHaveLength(1);
		expect(final.journeys[0]?.position).toMatchObject({
			latitude: 0,
			longitude: 0.02,
			atStop: true,
			distanceTraveled: 2000,
		});
		expect(final.journeys[0]?.calls?.map((call) => call.stopName)).toEqual(["C"]);
		// L'horodatage reste celui de l'arrivée au terminus, pas celui du cycle.
		expect(final.journeys[0]?.position.recordedAt).toBe("2026-05-18T08:20:00+00:00");

		// Une seule publication de grâce : au cycle suivant, la course a disparu.
		expect((await cycleAt(source, "08:20:45")).journeys).toHaveLength(0);
	});

	it("ne publie rien au tout premier cycle d'une source", async () => {
		expect((await cycleAt(scheduledSource(), "08:20:15")).journeys).toHaveLength(0);
	});

	it("ne ressuscite pas les courses terminées pendant une longue interruption", async () => {
		const source = scheduledSource();

		await cycleAt(source, "08:15:00");
		expect((await cycleAt(source, "08:25:00")).journeys).toHaveLength(0);
	});

	it("laisse la course suivante du roulement passer avant la publication finale", async () => {
		const source = blockSource({ getAheadTime: () => 300 });

		const before = await cycleAt(source, "08:19:45");
		expect(before.journeys.map((journey) => journey.journeyRef)).toEqual(["network:ServiceJourney:t1"]);

		// t1 est itérée en premier : sans publication différée, elle prendrait la clé ServiceBlock
		// que t2 partage avec elle, et t2 disparaîtrait alors qu'elle vient de prendre son service.
		const after = await cycleAt(source, "08:20:15");
		expect(after.journeys.map((journey) => journey.journeyRef)).toEqual(["network:ServiceJourney:t2"]);
	});

	it("ne republie pas une course encore suivie par une position GPS", async () => {
		const source = scheduledSource();

		const tracked = await cycleAt(source, "08:19:45", {
			vehiclePositions: [
				{
					timestamp: epochSeconds("2026-05-18T08:19:45Z"),
					trip: { tripId: "original", routeId: "line:1", startDate: "2026-05-18" },
					vehicle: { id: "vehicle:1" },
					position: { latitude: 0, longitude: 0.0195 },
				},
			],
		});
		expect(tracked.journeys[0]?.position.type).toBe("GPS");

		// La position GPS reste dans le store aval sous sa propre clé : republier la course
		// théorique afficherait deux marqueurs pour le même bus.
		expect((await cycleAt(source, "08:20:15")).journeys).toHaveLength(0);
	});
});

describe("Source#sweepJourneys", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("conserve les courses tout juste terminées le temps de leur publication finale", () => {
		const source = scheduledSource();
		vi.spyOn(console, "log").mockImplementation(() => {});

		vi.spyOn(Temporal.Now, "instant").mockReturnValue(Temporal.Instant.from("2026-05-18T08:21:00Z"));
		source.sweepJourneys();
		expect(source.gtfs?.journeys.size).toBe(1);

		vi.spyOn(Temporal.Now, "instant").mockReturnValue(Temporal.Instant.from("2026-05-18T08:23:00Z"));
		source.sweepJourneys();
		expect(source.gtfs?.journeys.size).toBe(0);
	});
});

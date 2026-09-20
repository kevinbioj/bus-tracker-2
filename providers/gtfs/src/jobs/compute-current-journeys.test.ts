import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { downloadGtfsRt } from "../download/download-gtfs-rt.js";
import { Agency } from "../model/agency.js";
import type { Gtfs } from "../model/gtfs.js";
import type { IdentifiedTripModifications, TripUpdate, VehiclePosition } from "../model/gtfs-rt.js";
import { createRealtimeResources, type RealtimeResources } from "../model/realtime-lookup.js";
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
		shapes: new Map(trip.shape !== undefined ? [[trip.shape.id, trip.shape]] : []),
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
async function cycleAt(
	source: Source,
	time: string,
	realtime?: {
		tripUpdates?: TripUpdate[];
		vehiclePositions?: VehiclePosition[];
		tripModifications?: IdentifiedTripModifications[];
		resources?: RealtimeResources;
		failedFeedCount?: number;
	},
) {
	vi.spyOn(Temporal.Now, "instant").mockReturnValue(Temporal.Instant.from(`2026-05-18T${time}Z`));
	vi.mocked(downloadGtfsRt).mockResolvedValue({
		tripUpdates: realtime?.tripUpdates ?? [],
		vehiclePositions: realtime?.vehiclePositions ?? [],
		tripModifications: realtime?.tripModifications ?? [],
		resources: realtime?.resources ?? createRealtimeResources(),
		failedFeedCount: realtime?.failedFeedCount ?? 0,
	});
	return computeVehicleJourneys(source);
}

/** Un TripUpdate ne portant aucun horaire temps réel, seulement la suppression de l'arrêt B. */
function skippedTripUpdate(time: string): TripUpdate {
	return {
		timestamp: epochSeconds(`2026-05-18T${time}Z`),
		trip: { tripId: "original", routeId: "line:1", startDate: "2026-05-18" },
		stopTimeUpdate: [{ stopId: "B", stopSequence: 2, scheduleRelationship: "SKIPPED" }],
	};
}

/** Statut publié pour l'arrêt B de la course `original`. */
function statusOfB(result: Awaited<ReturnType<typeof computeVehicleJourneys>>) {
	return result.journeys[0]?.calls?.find((call) => call.stopRef.endsWith(":B"))?.callStatus;
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
		shapes: new Map([[shape.id, shape]]),
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
			tripModifications: [],
			resources: createRealtimeResources(),
			failedFeedCount: 0,
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
		expect(journeys[0]?.direction).toBeUndefined();
		// La course garde sa propre identité : `journeyRef` porte l'identifiant que le flux lui donne,
		// il ne désigne pas la course théorique dont elle n'a pas trouvé le tracé.
		expect(journeys[0]?.journeyRef).toBe("network:ServiceJourney:added");
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
			tripModifications: [],
			resources: createRealtimeResources(),
			failedFeedCount: 0,
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
		vi.mocked(downloadGtfsRt).mockResolvedValue({
			tripUpdates: [delayedTripUpdate(2 * 60)],
			vehiclePositions: [],
			tripModifications: [],
			resources: createRealtimeResources(),
			failedFeedCount: 0,
		});
		const first = await computeVehicleJourneys(source);

		vi.spyOn(Temporal.Now, "instant").mockReturnValue(Temporal.Instant.from("2026-05-18T08:05:30Z"));
		vi.mocked(downloadGtfsRt).mockResolvedValue({
			tripUpdates: [delayedTripUpdate(5 * 60)],
			vehiclePositions: [],
			tripModifications: [],
			resources: createRealtimeResources(),
			failedFeedCount: 0,
		});
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

	it("ne republie pas sous une autre clé une course dont le véhicule est parti au terminus", async () => {
		const source = scheduledSource();
		// Le descripteur véhicule expire selon l'horloge système.
		vi.spyOn(Date, "now").mockReturnValue(Temporal.Instant.from("2026-05-18T08:20:15Z").epochMilliseconds);
		const tripUpdate = (time: string, withVehicle: boolean): TripUpdate => ({
			timestamp: epochSeconds(`2026-05-18T${time}Z`),
			trip: { tripId: "original", routeId: "line:1", startDate: "2026-05-18" },
			vehicle: withVehicle ? { id: "vehicle:1" } : undefined,
			stopTimeUpdate: [{ stopId: "C", stopSequence: 3, arrival: { delay: 0 } }],
		});

		const tracked = await cycleAt(source, "08:19:45", { tripUpdates: [tripUpdate("08:19:45", true)] });
		expect(tracked.journeys.map((journey) => journey.id)).toEqual(["network::VehicleTracking:vehicle:1"]);

		// Le TripUpdate reste dans le flux sans descripteur : le véhicule a pris sa course suivante.
		expect((await cycleAt(source, "08:20:15", { tripUpdates: [tripUpdate("08:20:15", false)] })).journeys).toHaveLength(
			0,
		);
	});
});

describe("computeVehicleJourneys (expiration des TripUpdate disparus)", () => {
	beforeEach(() => {
		(console as DraftConsole).draft = vi.fn(() => vi.fn());
	});

	afterEach(() => {
		vi.restoreAllMocks();
		Reflect.deleteProperty(console, "draft");
	});

	it("rétablit un arrêt supprimé dès que le TripUpdate quitte le flux", async () => {
		const source = scheduledSource({ tripUpdateTtlMs: 0 });

		const skipped = await cycleAt(source, "08:02:00", { tripUpdates: [skippedTripUpdate("08:02:00")] });
		expect(statusOfB(skipped)).toBe("SKIPPED");

		// Le producteur a levé la perturbation : la course n'est plus dans le flux, et aucun horaire
		// temps réel n'a jamais été publié pour elle.
		const restored = await cycleAt(source, "08:03:00");
		expect(statusOfB(restored)).toBe("SCHEDULED");
	});

	it("conserve l'arrêt supprimé tant que le délai de tolérance n'est pas écoulé", async () => {
		const source = scheduledSource();
		const journey = source.gtfs!.journeys.get(`${DATE}-original`)!;
		// B n'est plus publié une fois son heure passée : l'état est lu sur la course elle-même.
		const statusOfCallB = () => journey.calls[1]?.status;

		await cycleAt(source, "08:02:00", { tripUpdates: [skippedTripUpdate("08:02:00")] });
		expect(statusOfCallB()).toBe("SKIPPED");

		// Flux intermittent : une absence ponctuelle ne doit pas effacer la perturbation.
		await cycleAt(source, "08:03:00");
		expect(statusOfCallB()).toBe("SKIPPED");

		await cycleAt(source, "08:12:30");
		expect(statusOfCallB()).toBe("SCHEDULED");
	});

	it("n'expire rien lors d'un cycle où un flux n'a pas répondu", async () => {
		const source = scheduledSource({ tripUpdateTtlMs: 0 });

		await cycleAt(source, "08:02:00", { tripUpdates: [skippedTripUpdate("08:02:00")] });

		const failed = await cycleAt(source, "08:03:00", { failedFeedCount: 1 });
		expect(statusOfB(failed)).toBe("SKIPPED");

		const recovered = await cycleAt(source, "08:04:00");
		expect(statusOfB(recovered)).toBe("SCHEDULED");
	});

	it("restaure les horaires théoriques et les bornes de la course", async () => {
		const source = scheduledSource({ tripUpdateTtlMs: 0 });
		const journey = source.gtfs!.journeys.get(`${DATE}-original`)!;

		await cycleAt(source, "08:05:00", { tripUpdates: [delayedTripUpdate(5 * 60)] });
		expect(journey.hasRealtime()).toBe(true);
		expect(journey.lastCallDepartureMs).toBe(Temporal.Instant.from("2026-05-18T08:25:00Z").epochMilliseconds);

		const restored = await cycleAt(source, "08:06:00");
		expect(journey.hasRealtime()).toBe(false);
		expect(journey.lastCallDepartureMs).toBe(Temporal.Instant.from("2026-05-18T08:20:00Z").epochMilliseconds);
		expect(restored.journeys[0]?.calls?.every((call) => call.expectedTime === undefined)).toBe(true);
	});
});

describe("computeVehicleJourneys (positions figées)", () => {
	beforeEach(() => {
		(console as DraftConsole).draft = vi.fn(() => vi.fn());
	});

	afterEach(() => {
		vi.restoreAllMocks();
		Reflect.deleteProperty(console, "draft");
	});

	/** Position émise à `time` puis plus jamais : le terminal embarqué s'est déconnecté. */
	function frozenVehiclePosition(time: string): VehiclePosition {
		return {
			timestamp: epochSeconds(`2026-05-18T${time}Z`),
			trip: { tripId: "original", routeId: "line:1", startDate: "2026-05-18" },
			vehicle: { id: "vehicle:1" },
			position: { latitude: 0, longitude: 0.005 },
		};
	}

	const frozen = { vehiclePositions: [frozenVehiclePosition("08:05:00")], tripUpdates: [delayedTripUpdate(5 * 60)] };

	it("publie la position figée tant que le délai n'est pas écoulé", async () => {
		const source = scheduledSource({ maxVehiclePositionAgeMs: 10 * 60_000 });

		const result = await cycleAt(source, "08:14:00", frozen);
		expect(result.journeys[0]?.position).toMatchObject({ type: "GPS", longitude: 0.005 });
	});

	it("écarte la position figée et rend la main à l'horaire théorique", async () => {
		const source = scheduledSource({ maxVehiclePositionAgeMs: 10 * 60_000 });
		const journey = source.gtfs!.journeys.get(`${DATE}-original`)!;

		// Le TripUpdate est toujours dans le flux et continue de dériver derrière le terminal muet.
		const result = await cycleAt(source, "08:16:00", frozen);

		expect(journey.hasRealtime()).toBe(false);
		expect(result.journeys).toHaveLength(1);
		expect(result.journeys[0]?.position.type).toBe("COMPUTED");
		expect(result.journeys[0]?.calls?.every((call) => call.expectedTime === undefined)).toBe(true);
	});

	it("fait disparaître le véhicule quand la source ne publie pas le théorique", async () => {
		const source = scheduledSource({ maxVehiclePositionAgeMs: 10 * 60_000, excludeScheduled: true });

		expect((await cycleAt(source, "08:16:00", frozen)).journeys).toHaveLength(0);
	});

	it("conserve la position figée en l'absence de l'option", async () => {
		const source = scheduledSource();

		const result = await cycleAt(source, "08:16:00", frozen);
		expect(result.journeys[0]?.position).toMatchObject({ type: "GPS", longitude: 0.005 });
	});
});

/**
 * Course transfrontalière d'une agence déclarée en `Europe/Paris` (UTC+2 en mai) dont le dernier
 * arrêt est portugais (UTC+1) : A 10:00, B 10:30, C 11:00 heures locales respectives.
 */
function crossBorderSource() {
	const source = makeSource();
	const agency = new Agency("agency", "Agency", "Europe/Paris");
	const route = new Route("line:1", agency, "1", "COACH");
	const service = new Service("service", [true, true, true, true, true, true, true]);
	const stops = [
		new Stop("A", "A", 0, 0),
		new Stop("B", "B", 0, 0.01),
		new Stop("C", "C", 0, 0.02, undefined, "Europe/Lisbon"),
	];
	const store = new StopTimeStore(
		stops,
		new Uint8Array([1, 2, 3]),
		new Uint8Array([0, 0, 0]),
		new Uint32Array([10 * 3600, 10 * 3600 + 30 * 60, 11 * 3600]),
		new Uint32Array([10 * 3600, 10 * 3600 + 30 * 60, 11 * 3600]),
		new Float32Array([0, 1000, 2000]),
		new Uint32Array([0]),
		new Uint32Array([3]),
		new Uint32Array([10 * 3600]),
		new Uint32Array([11 * 3600]),
		new Uint32Array([11 * 3600]),
	);
	const trip = new Trip(0, "original", route, service, store, 0, "Terminus");
	source.gtfs = {
		routes: new Map([[route.id, route]]),
		stops: new Map(stops.map((stop) => [stop.id, stop])),
		trips: new Map([[trip.id, trip]]),
		shapes: new Map(),
		journeys: new Map([[`${DATE}-original`, trip.getScheduledJourney(DATE, true)]]),
		stopTimeStore: store,
		importedAt: Temporal.Instant.from("2026-05-18T00:00:00Z"),
		lastModified: null,
		etag: null,
	};
	return source;
}

/**
 * Réplique de `configurations/macron-bus.mjs` : agence déclarée en `UTC`, arrêts portant tous
 * `stop_timezone=Europe/Paris`, suivi par positions GPS uniquement.
 *
 * A 10:00 → B 10:30 → C 11:00, heures locales françaises.
 */
function flixbusLikeSource() {
	const source = makeSource({ excludeScheduled: true, mode: "NO-TU", isValidJourney: (vj) => vj.line !== undefined });
	const agency = new Agency("agency", "Agency", "UTC");
	const route = new Route("line:1", agency, "1", "COACH");
	const service = new Service("service", [true, true, true, true, true, true, true]);
	const stops = [
		new Stop("A", "A", 0, 0, undefined, "Europe/Paris"),
		new Stop("B", "B", 0, 0.01, undefined, "Europe/Paris"),
		new Stop("C", "C", 0, 0.02, undefined, "Europe/Paris"),
	];
	const store = new StopTimeStore(
		stops,
		new Uint8Array([1, 2, 3]),
		new Uint8Array([0, 0, 0]),
		new Uint32Array([10 * 3600, 10 * 3600 + 30 * 60, 11 * 3600]),
		new Uint32Array([10 * 3600, 10 * 3600 + 30 * 60, 11 * 3600]),
		new Float32Array([0, 1000, 2000]),
		new Uint32Array([0]),
		new Uint32Array([3]),
		new Uint32Array([10 * 3600]),
		new Uint32Array([11 * 3600]),
		new Uint32Array([11 * 3600]),
	);
	const trip = new Trip(0, "original", route, service, store, 0, "Terminus");
	source.gtfs = {
		routes: new Map([[route.id, route]]),
		stops: new Map(stops.map((stop) => [stop.id, stop])),
		trips: new Map([[trip.id, trip]]),
		shapes: new Map(trip.shape !== undefined ? [[trip.shape.id, trip.shape]] : []),
		journeys: new Map(),
		stopTimeStore: store,
		importedAt: Temporal.Instant.from("2026-05-18T00:00:00Z"),
		lastModified: null,
		etag: null,
	};
	return source;
}

/**
 * Course dont l'arrêt B comporte un temps de stationnement : arrivée 8:10, départ 8:12.
 * A (8:00) et le terminus C (8:20) repartent aussitôt arrivés.
 */
function dwellingSource(options?: Partial<SourceOptions>) {
	const source = makeSource(options);
	const agency = new Agency("agency", "Agency", "UTC");
	const route = new Route("line:1", agency, "1", "RAIL");
	const service = new Service("service", [true, true, true, true, true, true, true]);
	const stops = [new Stop("A", "A", 0, 0), new Stop("B", "B", 0, 0.01), new Stop("C", "C", 0, 0.02)];
	const store = new StopTimeStore(
		stops,
		new Uint8Array([1, 2, 3]),
		new Uint8Array([0, 0, 0]),
		new Uint32Array([8 * 3600, 8 * 3600 + 10 * 60, 8 * 3600 + 20 * 60]),
		new Uint32Array([8 * 3600, 8 * 3600 + 12 * 60, 8 * 3600 + 20 * 60]),
		new Float32Array([0, 1000, 2000]),
		new Uint32Array([0]),
		new Uint32Array([3]),
		new Uint32Array([8 * 3600]),
		new Uint32Array([8 * 3600 + 20 * 60]),
		new Uint32Array([8 * 3600 + 20 * 60]),
	);
	const trip = new Trip(0, "original", route, service, store, 0, "Terminus");
	source.gtfs = {
		routes: new Map([[route.id, route]]),
		stops: new Map(stops.map((stop) => [stop.id, stop])),
		trips: new Map([[trip.id, trip]]),
		shapes: new Map(),
		journeys: new Map([[`${DATE}-original`, trip.getScheduledJourney(DATE, true)]]),
		stopTimeStore: store,
		importedAt: Temporal.Instant.from("2026-05-18T00:00:00Z"),
		lastModified: null,
		etag: null,
	};
	return source;
}

describe("computeVehicleJourneys (temps de stationnement)", () => {
	beforeEach(() => {
		(console as DraftConsole).draft = vi.fn(() => vi.fn());
	});

	afterEach(() => {
		vi.restoreAllMocks();
		Reflect.deleteProperty(console, "draft");
	});

	it("publie l'heure d'arrivée à part quand elle diffère du départ", async () => {
		// 08:05 : la course a quitté A et roule vers B.
		const { journeys } = await cycleAt(dwellingSource(), "08:05:00");

		const [b, c] = journeys[0]!.calls!;
		// B stationne : `aimedTime` reste le départ, l'arrivée est publiée en plus.
		expect(b!.aimedTime).toBe("2026-05-18T08:12:00+00:00");
		expect(b!.aimedArrivalTime).toBe("2026-05-18T08:10:00+00:00");
		// Le terminus n'a pas de départ : son `aimedTime` porte déjà l'arrivée, inutile de la répéter.
		expect(c!.aimedTime).toBe("2026-05-18T08:20:00+00:00");
		expect(c!.aimedArrivalTime).toBeUndefined();
	});

	it("garde l'arrêt publié pendant tout le stationnement", async () => {
		// 08:11 : le véhicule est à quai en B, entre son arrivée et son départ.
		const { journeys } = await cycleAt(dwellingSource(), "08:11:00");

		const calls = journeys[0]!.calls!;
		expect(calls[0]!.stopName).toBe("B");
		expect(calls[0]!.aimedArrivalTime).toBe("2026-05-18T08:10:00+00:00");
	});

	it("décale arrivée et départ du même retard temps réel", async () => {
		const { journeys } = await cycleAt(dwellingSource(), "08:05:00", {
			tripUpdates: [delayedTripUpdate(120)],
		});

		const [b] = journeys[0]!.calls!;
		expect(b!.expectedArrivalTime).toBe("2026-05-18T08:12:00+00:00");
		expect(b!.expectedTime).toBe("2026-05-18T08:14:00+00:00");
	});
});

describe("computeVehicleJourneys (course multi-fuseaux)", () => {
	beforeEach(() => {
		(console as DraftConsole).draft = vi.fn(() => vi.fn());
	});

	afterEach(() => {
		vi.restoreAllMocks();
		Reflect.deleteProperty(console, "draft");
	});

	it("restitue chaque arrêt en heure locale sans déplacer l'instant", async () => {
		// 08:15 UTC : la course a quitté A (08:00 UTC) et n'a pas encore atteint B (08:30 UTC).
		const { journeys } = await cycleAt(crossBorderSource(), "08:15:00");

		const calls = journeys[0]!.calls!;
		// C est atteint à 11:00 heure de l'agence (09:00 UTC), soit 10:00 heure locale portugaise :
		// l'heure murale recule en franchissant la frontière, l'instant lui continue d'avancer.
		expect(calls.map((call) => call.aimedTime)).toEqual([
			"2026-05-18T10:30:00+02:00", // B, heure locale française
			"2026-05-18T10:00:00+01:00", // C, heure locale portugaise
		]);
		expect(new Date(calls[1]!.aimedTime).toISOString()).toBe("2026-05-18T09:00:00.000Z");
	});

	it("applique le fuseau de l'arrêt à une course suivie en GPS", async () => {
		// Réplique de la configuration FlixBus : agence en UTC — donc horaires exprimés en UTC —
		// et arrêts en Europe/Paris, suivis par un flux VehiclePosition seul (`NO-TU`).
		const source = flixbusLikeSource();

		const { journeys } = await cycleAt(source, "10:15:00", {
			vehiclePositions: [
				{
					timestamp: epochSeconds("2026-05-18T10:15:00Z"),
					trip: { tripId: "original", routeId: "line:1", startDate: "2026-05-18" },
					vehicle: { id: "vehicle:1" },
					position: { latitude: 0, longitude: 0.005 },
				},
			],
		});

		expect(journeys[0]!.position.type).toBe("GPS");
		// 10:30 UTC au fichier, publié en 12:30 heure de Paris — et non 10:30+02:00.
		expect(journeys[0]!.calls!.map((call) => call.aimedTime)).toEqual([
			"2026-05-18T12:30:00+02:00", // B
			"2026-05-18T13:00:00+02:00", // C
		]);
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

/** Déviation remplaçant l'arrêt B par l'arrêt X, douze minutes après le départ de A. */
function detour(overrides?: Partial<IdentifiedTripModifications>): IdentifiedTripModifications {
	return {
		id: "detour:1",
		serviceDates: ["20260518"],
		selectedTrips: [{ tripIds: ["original"] }],
		modifications: [
			{
				startStopSelector: { stopSequence: 2 },
				endStopSelector: { stopSequence: 2 },
				replacementStops: [{ stopId: "X", travelTimeToStop: 12 * 60 }],
			},
		],
		...overrides,
	};
}

/** Tracé publié par le flux, passant par l'arrêt de déviation. */
function detourResources() {
	const resources = createRealtimeResources();
	resources.shapes.set(
		"shape:detour",
		new Shape("shape:detour", new Float64Array([0, 0, 0, 0.01, 0.01, 1500, 0, 0.02, 3000])),
	);
	return resources;
}

function callsOf(result: Awaited<ReturnType<typeof computeVehicleJourneys>>) {
	return result.journeys[0]?.calls?.map((call) => `${call.stopName}:${call.callStatus}`);
}

describe("computeVehicleJourneys (dessertes déviées)", () => {
	beforeEach(() => {
		(console as DraftConsole).draft = () => () => {};
	});

	afterEach(() => {
		vi.restoreAllMocks();
		Reflect.deleteProperty(console, "draft");
	});

	it("insère l'arrêt de déviation et conserve l'arrêt remplacé", async () => {
		const source = scheduledSource();

		const result = await cycleAt(source, "08:05:00", { tripModifications: [detour()] });

		expect(callsOf(result)).toEqual(["B:SKIPPED", "Replacement:UNSCHEDULED", "C:SCHEDULED"]);
	});

	it("renumérote les arrêts de la course déviée", async () => {
		const source = scheduledSource();

		const result = await cycleAt(source, "08:05:00", { tripModifications: [detour()] });

		// L'arrêt de déviation prend la place 3, que C occupait dans le GTFS statique.
		expect(result.journeys[0]?.calls?.map((call) => [call.stopName, call.stopOrder])).toEqual([
			["B", 2],
			["Replacement", 3],
			["C", 4],
		]);
	});

	it("publie le tracé de remplacement plutôt que celui de la course", async () => {
		const source = scheduledSource();

		const { journeys, paths } = await cycleAt(source, "08:05:00", {
			tripModifications: [detour({ selectedTrips: [{ tripIds: ["original"], shapeId: "shape:detour" }] })],
			resources: detourResources(),
		});

		expect(journeys[0]?.pathRef).toBe("network:RoutePath:test:shape:detour");
		expect(Object.keys(paths)).toEqual([
			"network:RoutePath:test:shape:detour",
			"network:CancelledPath:test:original:2026-05-18",
		]);
	});

	it("publie la portion de tracé que la déviation fait abandonner", async () => {
		const source = scheduledSource();

		const { journeys, paths } = await cycleAt(source, "08:05:00", {
			tripModifications: [detour({ selectedTrips: [{ tripIds: ["original"], shapeId: "shape:detour" }] })],
			resources: detourResources(),
		});

		const cancelledPathRef = journeys[0]?.cancelledPathRef;
		expect(cancelledPathRef).toBe("network:CancelledPath:test:original:2026-05-18");

		// L'arrêt B est retiré : la portion abandonnée relie ses deux voisins, soit tout le tracé.
		expect(paths[cancelledPathRef!]).toEqual({
			segments: [
				[
					[0, 0],
					[0, 0.01],
					[0, 0.02],
				],
			],
		});
	});

	it("ne publie aucun tracé abandonné quand la déviation n'apporte pas son propre tracé", async () => {
		const source = scheduledSource();

		const { journeys, paths } = await cycleAt(source, "08:05:00", {
			tripModifications: [detour()],
			resources: detourResources(),
		});

		expect(journeys[0]?.cancelledPathRef).toBeUndefined();
		expect(Object.keys(paths)).toEqual(["network:RoutePath:test:shape:original"]);
	});

	it("rétablit la desserte théorique quand la déviation quitte le flux", async () => {
		const source = scheduledSource({ tripUpdateTtlMs: 0 });

		await cycleAt(source, "08:05:00", { tripModifications: [detour()] });
		const result = await cycleAt(source, "08:06:00");

		expect(callsOf(result)).toEqual(["B:SCHEDULED", "C:SCHEDULED"]);
	});

	it("conserve la déviation tant que le délai de tolérance n'est pas écoulé", async () => {
		const source = scheduledSource();

		await cycleAt(source, "08:05:00", { tripModifications: [detour()] });
		const result = await cycleAt(source, "08:06:00");

		expect(callsOf(result)).toEqual(["B:SKIPPED", "Replacement:UNSCHEDULED", "C:SCHEDULED"]);
	});

	it("ne rétablit rien lors d'un cycle où un flux n'a pas répondu", async () => {
		const source = scheduledSource({ tripUpdateTtlMs: 0 });

		await cycleAt(source, "08:05:00", { tripModifications: [detour()] });
		const result = await cycleAt(source, "08:06:00", { failedFeedCount: 1 });

		expect(callsOf(result)).toEqual(["B:SKIPPED", "Replacement:UNSCHEDULED", "C:SCHEDULED"]);
	});

	it("applique un TripUpdate rattaché à la course déviée sur la numérotation déviée", async () => {
		const source = scheduledSource();

		const result = await cycleAt(source, "08:05:00", {
			tripModifications: [detour()],
			tripUpdates: [
				{
					timestamp: epochSeconds("2026-05-18T08:05:00Z"),
					trip: { modifiedTrip: { modificationsId: "detour:1", affectedTripId: "original" } },
					stopTimeUpdate: [{ stopId: "X", stopSequence: 3, arrival: { delay: 120 }, departure: { delay: 120 } }],
				},
			],
		});

		const replacementCall = result.journeys[0]?.calls?.find((call) => call.stopName === "Replacement");
		expect(replacementCall?.callStatus).toBe("UNSCHEDULED");
		expect(replacementCall?.expectedTime).toBe("2026-05-18T08:14:00+00:00");
	});

	it("apparie par arrêt un TripUpdate qui ignore la renumérotation de la déviation", async () => {
		const source = scheduledSource();

		const result = await cycleAt(source, "08:05:00", {
			tripModifications: [detour()],
			tripUpdates: [
				{
					timestamp: epochSeconds("2026-05-18T08:05:00Z"),
					trip: { tripId: "original", routeId: "line:1", startDate: "2026-05-18" },
					// Séquence 3 dans le GTFS statique, mais l'arrêt de déviation la porte désormais.
					stopTimeUpdate: [{ stopId: "C", stopSequence: 3, arrival: { delay: 60 }, departure: { delay: 60 } }],
				},
			],
		});

		const calls = result.journeys[0]?.calls;
		expect(calls?.find((call) => call.stopName === "C")?.expectedTime).toBe("2026-05-18T08:21:00+00:00");
		expect(calls?.find((call) => call.stopName === "Replacement")?.expectedTime).toBe("2026-05-18T08:12:00+00:00");
	});

	it("apparie par arrêt une position qui ignore la renumérotation de la déviation", async () => {
		const source = scheduledSource();

		const result = await cycleAt(source, "08:05:00", {
			tripModifications: [detour()],
			vehiclePositions: [
				{
					timestamp: epochSeconds("2026-05-18T08:05:00Z"),
					trip: { tripId: "original", routeId: "line:1", startDate: "2026-05-18" },
					vehicle: { id: "vehicle:1" },
					position: { latitude: 0, longitude: 0.015 },
					// Séquence 3 dans le GTFS statique, mais l'arrêt de déviation la porte désormais :
					// s'y fier ferait réapparaître un arrêt déjà desservi en tête de la desserte.
					currentStopSequence: 3,
					stopId: "C",
				},
			],
		});

		expect(callsOf(result)).toEqual(["C:SCHEDULED"]);
	});

	it("suit la numérotation déviée d'une position rattachée à la course modifiée", async () => {
		const source = scheduledSource();

		const result = await cycleAt(source, "08:05:00", {
			tripModifications: [detour()],
			vehiclePositions: [
				{
					timestamp: epochSeconds("2026-05-18T08:05:00Z"),
					trip: { modifiedTrip: { modificationsId: "detour:1", affectedTripId: "original" } },
					vehicle: { id: "vehicle:1" },
					position: { latitude: 0.01, longitude: 0.01 },
					currentStopSequence: 3,
				},
			],
		});

		expect(callsOf(result)).toEqual(["Replacement:UNSCHEDULED", "C:SCHEDULED"]);
	});
});

/** Course supplémentaire A 8:00 → X 8:10 → C 8:20, étrangère au GTFS statique. */
function newTripUpdate(overrides?: Partial<TripUpdate>): TripUpdate {
	return {
		timestamp: epochSeconds("2026-05-18T08:05:00Z"),
		trip: { tripId: "extra", routeId: "line:1", startDate: "2026-05-18", scheduleRelationship: "NEW" },
		vehicle: { id: "vehicle:9" },
		stopTimeUpdate: [
			{ stopId: "A", stopSequence: 1, departure: { time: epochSeconds("2026-05-18T08:00:00Z") } },
			{ stopId: "X", stopSequence: 2, arrival: { time: epochSeconds("2026-05-18T08:10:00Z") } },
			{ stopId: "C", stopSequence: 3, arrival: { time: epochSeconds("2026-05-18T08:20:00Z") } },
		],
		...overrides,
	};
}

/** Source dont aucune course théorique n'est pré-calculée : seules les courses du flux sont publiées. */
function addedTripSource(options?: Partial<SourceOptions>) {
	const source = makeSource(options);
	source.gtfs = makeGtfs();
	return source;
}

describe("computeVehicleJourneys (courses supplémentaires)", () => {
	beforeEach(() => {
		(console as DraftConsole).draft = () => () => {};
	});

	afterEach(() => {
		vi.restoreAllMocks();
		Reflect.deleteProperty(console, "draft");
	});

	it("publie une course NEW sans attendre d'appariement de tracé", async () => {
		const source = addedTripSource();

		const { journeys } = await cycleAt(source, "08:05:00", { tripUpdates: [newTripUpdate()] });

		expect(journeys).toHaveLength(1);
		expect(journeys[0]?.id).toBe("network::VehicleTracking:vehicle:9");
		expect(journeys[0]?.pathRef).toBeUndefined();
		expect(journeys[0]?.calls?.map((call) => `${call.stopName}:${call.callStatus}`)).toEqual([
			"Replacement:UNSCHEDULED",
			"C:UNSCHEDULED",
		]);
	});

	it("suit le tracé que la course NEW déclare", async () => {
		const source = addedTripSource();

		const { journeys, paths } = await cycleAt(source, "08:05:00", {
			tripUpdates: [newTripUpdate({ tripProperties: { shapeId: "shape:detour" } })],
			resources: detourResources(),
		});

		expect(journeys[0]?.pathRef).toBe("network:RoutePath:test:shape:detour");
		expect(Object.keys(paths)).toEqual(["network:RoutePath:test:shape:detour"]);
		expect(journeys[0]?.position.atStop).toBe(false);
		expect(journeys[0]?.position.distanceTraveled).toBeGreaterThan(0);
	});

	it("reprend le tracé d'une course théorique quand l'appariement est demandé", async () => {
		const source = addedTripSource({ addedTripShapeMatching: true });

		const { journeys } = await cycleAt(source, "08:05:00", {
			tripUpdates: [
				newTripUpdate({
					stopTimeUpdate: [
						{ stopId: "A", stopSequence: 1, departure: { time: epochSeconds("2026-05-18T08:00:00Z") } },
						{ stopId: "B", stopSequence: 2, arrival: { time: epochSeconds("2026-05-18T08:10:00Z") } },
						{ stopId: "C", stopSequence: 3, arrival: { time: epochSeconds("2026-05-18T08:20:00Z") } },
					],
				}),
			],
		});

		expect(journeys[0]?.pathRef).toBe("network:RoutePath:test:shape:original");
	});

	it("n'affiche pas une course ADDED que la configuration n'a pas réclamée", async () => {
		const source = addedTripSource();

		const { journeys } = await cycleAt(source, "08:05:00", {
			tripUpdates: [
				newTripUpdate({
					trip: { tripId: "extra", routeId: "line:1", startDate: "2026-05-18", scheduleRelationship: "ADDED" },
				}),
			],
		});

		expect(journeys).toEqual([]);
	});

	it("nomme la course d'après les propriétés que le flux lui donne", async () => {
		const source = addedTripSource();

		const { journeys } = await cycleAt(source, "08:05:00", {
			tripUpdates: [newTripUpdate({ tripProperties: { tripId: "renfort:12", tripHeadsign: "Renfort" } })],
		});

		expect(journeys[0]?.destination).toBe("Renfort");
		expect(journeys[0]?.journeyRef).toBe("network:ServiceJourney:renfort:12");
		expect(journeys[0]?.serviceDate).toBe("2026-05-18");
	});

	it("reprend les propriétés d'arrêt du flux", async () => {
		const source = addedTripSource();

		const { journeys } = await cycleAt(source, "08:05:00", {
			tripUpdates: [
				newTripUpdate({
					stopTimeUpdate: [
						{ stopId: "A", stopSequence: 1, departure: { time: epochSeconds("2026-05-18T08:00:00Z") } },
						{
							stopId: "X",
							stopSequence: 2,
							arrival: { time: epochSeconds("2026-05-18T08:10:00Z") },
							stopTimeProperties: { pickupType: "NONE", stopHeadsign: "Dépôt" },
						},
						{ stopId: "C", stopSequence: 3, arrival: { time: epochSeconds("2026-05-18T08:20:00Z") } },
					],
				}),
			],
		});

		expect(journeys[0]?.calls?.[0]?.flags).toEqual(["NO_PICKUP"]);
	});

	it("écarte une course supplémentaire réduite à un seul arrêt", async () => {
		const source = addedTripSource();

		const { journeys } = await cycleAt(source, "08:05:00", {
			tripUpdates: [
				newTripUpdate({
					stopTimeUpdate: [{ stopId: "A", stopSequence: 1, departure: { time: epochSeconds("2026-05-18T08:00:00Z") } }],
				}),
			],
		});

		expect(journeys).toEqual([]);
	});

	it("traite une course DELETED comme une course supprimée", async () => {
		const source = scheduledSource();

		const { journeys } = await cycleAt(source, "08:05:00", {
			tripUpdates: [
				{
					timestamp: epochSeconds("2026-05-18T08:05:00Z"),
					trip: { tripId: "original", routeId: "line:1", startDate: "2026-05-18", scheduleRelationship: "DELETED" },
				},
			],
		});

		expect(journeys).toEqual([]);
	});

	it("ignore un TripUpdate dont le descripteur ne désigne aucune course", async () => {
		const source = scheduledSource();

		const { journeys } = await cycleAt(source, "08:05:00", {
			tripUpdates: [{ timestamp: epochSeconds("2026-05-18T08:05:00Z"), trip: { routeId: "line:1" } }],
		});

		expect(journeys).toHaveLength(1);
		expect(callsOf({ journeys, paths: {} })).toEqual(["B:SCHEDULED", "C:SCHEDULED"]);
	});
});

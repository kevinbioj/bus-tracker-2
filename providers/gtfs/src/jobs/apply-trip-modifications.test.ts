import { describe, expect, it } from "vitest";

import { Agency } from "../model/agency.js";
import type { Gtfs } from "../model/gtfs.js";
import type { IdentifiedTripModifications } from "../model/gtfs-rt.js";
import { createRealtimeResources } from "../model/realtime-lookup.js";
import { Route } from "../model/route.js";
import { Service } from "../model/service.js";
import { Shape } from "../model/shape.js";
import { Stop } from "../model/stop.js";
import { StopTimeStore } from "../model/stop-time-store.js";
import { Trip } from "../model/trip.js";
import { createShapeFromPolyline } from "../utils/decode-polyline.js";
import { indexTripModifications } from "./apply-trip-modifications.js";

function makeGtfs(): Gtfs {
	const agency = new Agency("agency", "Agency", "UTC");
	const route = new Route("line:1", agency, "1", "BUS");
	const service = new Service("service", [true, true, true, true, true, true, true]);
	const staticShape = new Shape("shape:static", new Float64Array([0, 0, 0, 0, 0.01, 1000, 0, 0.02, 2000]));
	const stops = [new Stop("A", "A", 0, 0), new Stop("B", "B", 0, 0.01), new Stop("X", "Déviation", 0.01, 0.01)];
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
	const trip = new Trip(0, "original", route, service, store, 0, "Terminus", undefined, staticShape);

	return {
		routes: new Map([[route.id, route]]),
		stops: new Map(stops.map((stop) => [stop.id, stop])),
		trips: new Map([[trip.id, trip]]),
		shapes: new Map([[staticShape.id, staticShape]]),
		journeys: new Map(),
		stopTimeStore: store,
		importedAt: Temporal.Instant.from("2026-05-18T00:00:00Z"),
		lastModified: null,
		etag: null,
	};
}

function makeEntity(overrides?: Partial<IdentifiedTripModifications>): IdentifiedTripModifications {
	return {
		id: "detour:1",
		serviceDates: ["20260518"],
		selectedTrips: [{ tripIds: ["original"] }],
		modifications: [
			{
				startStopSelector: { stopSequence: 2 },
				endStopSelector: { stopSequence: 2 },
				propagatedModificationDelay: 120,
				replacementStops: [{ stopId: "X", travelTimeToStop: 300 }],
			},
		],
		...overrides,
	};
}

describe("indexTripModifications", () => {
	it("indexe la déviation sous la clé de la course et de sa date de service", () => {
		const plans = indexTripModifications(makeGtfs(), [makeEntity()], createRealtimeResources());

		expect([...plans.keys()]).toEqual(["2026-05-18-original"]);
		expect(plans.get("2026-05-18-original")).toMatchObject({
			modificationsId: "detour:1",
			tripId: "original",
		});
	});

	it("résout les arrêts et convertit les durées en millisecondes", () => {
		const plan = indexTripModifications(makeGtfs(), [makeEntity()], createRealtimeResources()).get(
			"2026-05-18-original",
		)!;

		expect(plan.modifications).toHaveLength(1);
		expect(plan.modifications[0]?.propagatedModificationDelayMs).toBe(120_000);
		expect(plan.modifications[0]?.replacementStops).toEqual([
			{ stop: expect.objectContaining({ id: "X" }), travelTimeToStopMs: 300_000 },
		]);
	});

	it("indexe une déviation portant sur plusieurs dates et plusieurs courses", () => {
		const gtfs = makeGtfs();
		const other = new Trip(0, "other", gtfs.routes.get("line:1")!, new Service("service"), gtfs.stopTimeStore, 0);
		gtfs.trips.set(other.id, other);

		const plans = indexTripModifications(
			gtfs,
			[makeEntity({ serviceDates: ["20260518", "20260519"], selectedTrips: [{ tripIds: ["original", "other"] }] })],
			createRealtimeResources(),
		);

		expect([...plans.keys()].sort()).toEqual([
			"2026-05-18-original",
			"2026-05-18-other",
			"2026-05-19-original",
			"2026-05-19-other",
		]);
	});

	it("résout un tracé de remplacement publié par le flux temps réel", () => {
		const resources = createRealtimeResources();
		const shape = createShapeFromPolyline("shape:rt", "_p~iF~ps|U_ulLnnqC")!;
		resources.shapes.set(shape.id, shape);

		const plan = indexTripModifications(
			makeGtfs(),
			[makeEntity({ selectedTrips: [{ tripIds: ["original"], shapeId: "shape:rt" }] })],
			resources,
		).get("2026-05-18-original")!;

		expect(plan.shape).toBe(shape);
	});

	it("résout un tracé de remplacement défini dans le GTFS statique", () => {
		const gtfs = makeGtfs();

		const plan = indexTripModifications(
			gtfs,
			[makeEntity({ selectedTrips: [{ tripIds: ["original"], shapeId: "shape:static" }] })],
			createRealtimeResources(),
		).get("2026-05-18-original")!;

		expect(plan.shape).toBe(gtfs.shapes.get("shape:static"));
	});

	it("résout un arrêt de déviation publié par le flux temps réel", () => {
		const resources = createRealtimeResources();
		const rtStop = new Stop("RT", "Arrêt provisoire", 0.02, 0.02);
		resources.stops.set(rtStop.id, rtStop);

		const plan = indexTripModifications(
			makeGtfs(),
			[
				makeEntity({
					modifications: [
						{ startStopSelector: { stopSequence: 2 }, replacementStops: [{ stopId: "RT", travelTimeToStop: 60 }] },
					],
				}),
			],
			resources,
		).get("2026-05-18-original")!;

		expect(plan.modifications[0]?.replacementStops[0]?.stop).toBe(rtStop);
	});

	it("écarte un arrêt de remplacement introuvable sans perdre la déviation", () => {
		const plan = indexTripModifications(
			makeGtfs(),
			[
				makeEntity({
					modifications: [
						{
							startStopSelector: { stopSequence: 2 },
							endStopSelector: { stopSequence: 2 },
							replacementStops: [{ stopId: "inconnu", travelTimeToStop: 60 }, { stopId: "X" }],
						},
					],
				}),
			],
			createRealtimeResources(),
		).get("2026-05-18-original")!;

		expect(plan.modifications[0]?.replacementStops.map(({ stop }) => stop.id)).toEqual(["X"]);
	});

	it("ignore les courses absentes du GTFS, les dates illisibles et les entités vides", () => {
		const resources = createRealtimeResources();
		const gtfs = makeGtfs();

		expect(
			indexTripModifications(gtfs, [makeEntity({ selectedTrips: [{ tripIds: ["absente"] }] })], resources).size,
		).toBe(0);
		expect(indexTripModifications(gtfs, [makeEntity({ serviceDates: ["pas-une-date"] })], resources).size).toBe(0);
		expect(indexTripModifications(gtfs, [makeEntity({ serviceDates: [] })], resources).size).toBe(0);
		expect(indexTripModifications(gtfs, [makeEntity({ modifications: [] })], resources).size).toBe(0);
		expect(indexTripModifications(gtfs, [makeEntity({ selectedTrips: [] })], resources).size).toBe(0);
	});

	it("donne la même empreinte à deux lectures d'une déviation inchangée", () => {
		const gtfs = makeGtfs();
		const resources = createRealtimeResources();

		const first = indexTripModifications(gtfs, [makeEntity()], resources).get("2026-05-18-original")!;
		const second = indexTripModifications(gtfs, [makeEntity()], resources).get("2026-05-18-original")!;
		const changed = indexTripModifications(
			gtfs,
			[makeEntity({ modifications: [{ startStopSelector: { stopSequence: 2 } }] })],
			resources,
		).get("2026-05-18-original")!;

		expect(second.revision).toBe(first.revision);
		expect(changed.revision).not.toBe(first.revision);
	});
});

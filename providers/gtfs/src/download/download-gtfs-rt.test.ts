import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Source } from "../model/source.js";
import { downloadGtfsRt } from "./download-gtfs-rt.js";

const { transit_realtime } = GtfsRealtimeBindings;

const FEED_HREF = "https://example.com/gtfs-rt.pb";
/** Polyligne de référence de l'algorithme Google : trois points. */
const ENCODED_POLYLINE = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";

type FeedEntities = NonNullable<NonNullable<Parameters<typeof transit_realtime.FeedMessage.create>[0]>["entity"]>;

function encodeFeed(entity: FeedEntities) {
	return transit_realtime.FeedMessage.encode(
		transit_realtime.FeedMessage.create({
			header: { gtfsRealtimeVersion: "2.0", timestamp: 1_779_000_000 },
			entity,
		}),
	).finish();
}

function makeSource() {
	return new Source("test", {
		staticResourceHref: "https://example.com/gtfs.zip",
		realtimeResourceHrefs: [FEED_HREF],
		getNetworkRef: () => "network",
	});
}

/** Flux complet : une déviation, son tracé, son arrêt provisoire et un horaire temps réel. */
function serveFullFeed() {
	const bytes = encodeFeed([
		{
			id: "trip-update:1",
			tripUpdate: {
				trip: { tripId: "t1", scheduleRelationship: transit_realtime.TripDescriptor.ScheduleRelationship.SCHEDULED },
				stopTimeUpdate: [{ stopId: "A", stopSequence: 1, arrival: { delay: 60 } }],
			},
		},
		{
			id: "detour:1",
			tripModifications: {
				selectedTrips: [{ tripIds: ["t1"], shapeId: "s1" }],
				serviceDates: ["20260518"],
				modifications: [
					{
						startStopSelector: { stopSequence: 2 },
						endStopSelector: { stopSequence: 2 },
						propagatedModificationDelay: 60,
						replacementStops: [{ stopId: "rt-stop", travelTimeToStop: 120 }],
					},
				],
			},
		},
		{ id: "shape:1", shape: { shapeId: "s1", encodedPolyline: ENCODED_POLYLINE } },
		{
			id: "stop:1",
			stop: {
				stopId: "rt-stop",
				stopName: { translation: [{ text: "Arrêt provisoire", language: "fr" }] },
				stopLat: 48.85,
				stopLon: 2.35,
				platformCode: { translation: [{ text: "Q1" }] },
			},
		},
	]);

	vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(bytes, { status: 200 })));
}

describe("downloadGtfsRt", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("collecte les déviations avec l'identifiant de l'entité qui les porte", async () => {
		serveFullFeed();

		const { tripModifications } = await downloadGtfsRt(makeSource());

		expect(tripModifications).toHaveLength(1);
		expect(tripModifications[0]?.id).toBe("detour:1");
		expect(tripModifications[0]?.serviceDates).toEqual(["20260518"]);
		expect(tripModifications[0]?.selectedTrips).toEqual([{ tripIds: ["t1"], shapeId: "s1" }]);
		expect(tripModifications[0]?.modifications?.[0]).toMatchObject({
			startStopSelector: { stopSequence: 2 },
			propagatedModificationDelay: 60,
			replacementStops: [{ stopId: "rt-stop", travelTimeToStop: 120 }],
		});
	});

	it("décode les tracés publiés par le flux", async () => {
		serveFullFeed();

		const { resources } = await downloadGtfsRt(makeSource());

		expect(resources.shapes.get("s1")?.length).toBe(3);
		expect(resources.shapes.get("s1")?.getPoint(0)).toEqual([38.5, -120.2]);
	});

	it("projette les arrêts publiés par le flux sur le modèle interne", async () => {
		serveFullFeed();

		const { resources } = await downloadGtfsRt(makeSource());

		const stop = resources.stops.get("rt-stop");
		expect(stop).toMatchObject({ id: "rt-stop", name: "Arrêt provisoire", platformCode: "Q1" });
		// `stop_lat` et `stop_lon` sont des flottants 32 bits dans le protocole.
		expect(stop?.latitude).toBeCloseTo(48.85, 5);
		expect(stop?.longitude).toBeCloseTo(2.35, 5);
	});

	it("continue de lire les horaires temps réel", async () => {
		serveFullFeed();

		const { tripUpdates, vehiclePositions, failedFeedCount } = await downloadGtfsRt(makeSource());

		expect(failedFeedCount).toBe(0);
		expect(vehiclePositions).toEqual([]);
		expect(tripUpdates).toHaveLength(1);
		expect(tripUpdates[0]?.trip.tripId).toBe("t1");
		expect(tripUpdates[0]?.trip.scheduleRelationship).toBe("SCHEDULED");
		// Horodatage absent de l'entité : celui de l'en-tête du flux prend le relais.
		expect(tripUpdates[0]?.timestamp).toBe(1_779_000_000);
	});

	it("retient la déviation parmi les types d'entités observés du flux", async () => {
		serveFullFeed();
		const source = makeSource();

		await downloadGtfsRt(source);

		expect([...(source.observedRealtimeEntityTypes.get(FEED_HREF) ?? [])].sort()).toEqual([
			"TRIP_MODIFICATIONS",
			"TRIP_UPDATES",
		]);
	});

	it("écarte une déviation que la configuration refuse", async () => {
		serveFullFeed();
		const source = makeSource();
		source.options.mapTripModifications = () => undefined;

		const { tripModifications } = await downloadGtfsRt(source);

		expect(tripModifications).toEqual([]);
	});

	it("ignore un tracé dont la polyligne est inexploitable", async () => {
		const bytes = encodeFeed([{ id: "shape:1", shape: { shapeId: "s1", encodedPolyline: "_p~iF~ps|U" } }]);
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(bytes, { status: 200 })));

		const { resources } = await downloadGtfsRt(makeSource());

		expect(resources.shapes.size).toBe(0);
	});

	it("ignore un arrêt sans nom ni position", async () => {
		const bytes = encodeFeed([{ id: "stop:1", stop: { stopId: "rt-stop", stopLat: 48.85 } }]);
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(bytes, { status: 200 })));

		const { resources } = await downloadGtfsRt(makeSource());

		expect(resources.stops.size).toBe(0);
	});
});

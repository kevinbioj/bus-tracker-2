import { describe, expect, it } from "vitest";

import { indexStopAreas } from "../import/import-gtfs.js";
import { Agency } from "../model/agency.js";
import { type Gtfs, getJourneyKey } from "../model/gtfs.js";
import { createRealtimeResources } from "../model/realtime-lookup.js";
import { Route } from "../model/route.js";
import { Service } from "../model/service.js";
import { Source } from "../model/source.js";
import { Stop } from "../model/stop.js";
import { StopTimeStore } from "../model/stop-time-store.js";
import { Trip } from "../model/trip.js";

import { indexTripModifications } from "./apply-trip-modifications.js";
import { collectRealtimeStopAreas } from "./compute-current-journeys.js";
import { buildStopAreaManifests, getRealtimeServiceFingerprint } from "./publish-stop-areas.js";

const HOUR = 3600;
const DATE = Temporal.PlainDate.from("2026-05-18");
const NOW = Temporal.Instant.from("2026-05-18T07:30:00Z");

/**
 * Bus `original` A 8:00 → B 8:10 → C 8:20, et métro M1 → Z. La station `station-m` déclare le quai
 * de métro M1 et le quai P, qu'aucune course théorique ne dessert.
 */
function makeSource() {
	const agency = new Agency("agency", "Agency", "UTC");
	const bus = new Route("bus", agency, "1", "BUS");
	const metro = new Route("metro", agency, "M", "SUBWAY");
	const service = new Service("service", [true, true, true, true, true, true, true]);
	const stops = [
		new Stop("A", "A", 0, 0),
		new Stop("B", "B", 0, 0.01),
		new Stop("C", "C", 0, 0.02),
		new Stop("M1", "Métro", 0.001, 0.01, undefined, undefined, "station-m"),
		new Stop("Z", "Z", 0.01, 0.01),
	];
	const platform = new Stop("P", "Métro (provisoire)", 0.001, 0.011, undefined, undefined, "station-m");
	const store = StopTimeStore.fromStops(
		stops,
		new Uint8Array([1, 2, 3, 1, 2]),
		new Uint8Array([0, 0, 0, 0, 0]),
		new Uint32Array([8 * HOUR, 8 * HOUR + 600, 8 * HOUR + 1200, 8 * HOUR, 8 * HOUR + 600]),
		new Uint32Array([8 * HOUR, 8 * HOUR + 600, 8 * HOUR + 1200, 8 * HOUR, 8 * HOUR + 600]),
		new Float32Array([0, 1000, 2000, 0, 1000]),
		new Uint32Array([0, 3]),
		new Uint32Array([3, 2]),
		new Uint32Array([8 * HOUR, 8 * HOUR]),
		new Uint32Array([8 * HOUR + 1200, 8 * HOUR + 600]),
		new Uint32Array([8 * HOUR + 1200, 8 * HOUR + 600]),
	);
	const original = new Trip(0, "original", bus, service, store, 0, "C");
	const subway = new Trip(1, "subway", metro, service, store, 0, "Z");
	const stations = new Map([
		[
			"station-m",
			{ id: "station-m", name: "Métro", latitude: 0.001, longitude: 0.01, platforms: [stops[3]!, platform] },
		],
	]);

	const source = new Source("test", {
		staticResourceHref: "https://example.com/gtfs.zip",
		getNetworkRef: () => "network",
	});
	const gtfs: Gtfs = {
		routes: new Map([bus, metro].map((route) => [route.id, route])),
		stops: new Map([...stops, platform].map((stop) => [stop.id, stop])),
		trips: new Map([original, subway].map((trip) => [trip.id, trip])),
		...indexStopAreas(store, [original, subway], stations),
		shapes: new Map(),
		journeys: new Map(),
		stopTimeStore: store,
		importedAt: Temporal.Instant.from("2026-05-18T00:00:00Z"),
		lastModified: null,
		etag: null,
	};
	source.gtfs = gtfs;

	return { source, gtfs, original };
}

/** Dévie `original` : B est remplacé par `stopId`. */
function detour(source: Source, gtfs: Gtfs, trip: Trip, stopId: string, resources = createRealtimeResources()) {
	const plan = indexTripModifications(
		gtfs,
		[
			{
				id: "detour:1",
				serviceDates: ["20260518"],
				selectedTrips: [{ tripIds: ["original"] }],
				modifications: [
					{
						startStopSelector: { stopSequence: 2 },
						endStopSelector: { stopSequence: 2 },
						replacementStops: [{ stopId, travelTimeToStop: 300 }],
					},
				],
			},
		],
		resources,
	).get("2026-05-18-original")!;

	const journeyKey = getJourneyKey(DATE, trip.id);
	const journey = trip.getScheduledJourney(DATE, true);
	journey.applyModifications(plan, NOW.epochMilliseconds);
	gtfs.journeys.set(journeyKey, journey);
	source.modifiedJourneyKeys.add(journeyKey);
	source.realtimeStopAreas = collectRealtimeStopAreas(source);
}

function stopPointOf(source: Source, stopId: string) {
	return buildStopAreaManifests("provider", source, NOW.toString())
		.find(({ ref }) => ref === "network:StopArea:station-m")
		?.stopPoints?.find(({ ref }) => ref === `network:StopPoint:${stopId}`);
}

describe("buildStopAreaManifests", () => {
	it("donne à un quai déclaré sans desserte le mode de sa station", () => {
		const { source } = makeSource();

		expect(stopPointOf(source, "P")).toMatchObject({ mode: "SUBWAY", lineRefs: [] });
	});

	it("donne à un quai déclaré le mode des lignes qui le desservent par déviation", () => {
		const { source, gtfs, original } = makeSource();
		detour(source, gtfs, original, "P");

		expect(stopPointOf(source, "P")).toMatchObject({ mode: "BUS", lineRefs: ["network:Line:bus"] });
		expect(stopPointOf(source, "M1")).toMatchObject({ mode: "SUBWAY" });
	});

	it("donne le mode bus à un arrêt du flux temps réel rattaché à une station de métro", () => {
		const { source, gtfs, original } = makeSource();
		const resources = createRealtimeResources();
		resources.stops.set("RT", new Stop("RT", "Métro (provisoire)", 0.001, 0.012, undefined, undefined, "station-m"));
		detour(source, gtfs, original, "RT", resources);

		expect(stopPointOf(source, "RT")).toMatchObject({ mode: "BUS", lineRefs: ["network:Line:bus"] });
	});

	it("ignore les courses que la configuration n'attribue à aucun réseau", () => {
		const { source } = makeSource();
		// Les configurations JavaScript écartent une course en renvoyant `null`.
		source.options.getNetworkRef = (journey) => (journey?.trip.route.id === "metro" ? (null as never) : "network");

		const manifests = buildStopAreaManifests("provider", source, NOW.toString());

		expect(manifests.map(({ ref }) => ref).sort()).toEqual(["network:StopArea:A", "network:StopArea:B"]);
		expect(manifests.map(({ networkRefs }) => networkRefs)).toEqual([["network"], ["network"]]);
	});
});

describe("getRealtimeServiceFingerprint", () => {
	it("change quand une déviation dessert un quai déclaré, puis cesse de le desservir", () => {
		const { source, gtfs, original } = makeSource();
		const before = getRealtimeServiceFingerprint(source);

		detour(source, gtfs, original, "P");
		const during = getRealtimeServiceFingerprint(source);

		source.modifiedJourneyKeys.clear();
		source.realtimeStopAreas = collectRealtimeStopAreas(source);

		expect(during).not.toBe(before);
		expect(getRealtimeServiceFingerprint(source)).toBe(before);
	});
});

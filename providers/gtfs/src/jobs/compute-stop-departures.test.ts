import { describe, expect, it } from "vitest";

import { indexStopAreas } from "../import/import-gtfs.js";
import { Agency } from "../model/agency.js";
import type { Gtfs } from "../model/gtfs.js";
import { getJourneyKey } from "../model/gtfs.js";
import { createRealtimeResources } from "../model/realtime-lookup.js";
import { Route } from "../model/route.js";
import { Service } from "../model/service.js";
import { Source, type SourceOptions } from "../model/source.js";
import { Stop } from "../model/stop.js";
import { StopArea } from "../model/stop-area.js";
import { StopTimeStore } from "../model/stop-time-store.js";
import { Trip } from "../model/trip.js";

import { indexTripModifications } from "./apply-trip-modifications.js";
import { computeStopDepartures } from "./compute-stop-departures.js";

const HOUR = 3600;

/**
 * Station « Mairie » composée de deux quais homonymes, desservis chacun par une course :
 * `aller` à 8:00 (quai A) et `retour` à 8:30 (quai B). Une troisième course `dimanche` part du
 * quai A à 8:15 mais ne circule que le dimanche.
 */
function makeGtfs(): Gtfs {
	const agency = new Agency("agency", "Agency", "UTC");
	const route = new Route("line:1", agency, "1", "BUS");
	const everyDay = new Service("every-day", [true, true, true, true, true, true, true]);
	const sundays = new Service("sundays", [false, false, false, false, false, false, true]);

	const mairieA = new Stop("mairie-a", "Mairie", 0, 0, "A");
	const mairieB = new Stop("mairie-b", "Mairie", 0, 0.0005, "B");
	const terminus = new Stop("terminus", "Terminus", 0, 0.02);

	const stops = [mairieA, terminus, mairieB, terminus, mairieA, terminus];
	const store = new StopTimeStore(
		stops,
		new Uint8Array([1, 2, 1, 2, 1, 2]),
		new Uint8Array([0, 0, 0, 0, 0, 0]),
		new Uint32Array([8 * HOUR, 8 * HOUR + 600, 8 * HOUR + 1800, 8 * HOUR + 2400, 8 * HOUR + 900, 8 * HOUR + 1500]),
		new Uint32Array([8 * HOUR, 8 * HOUR + 600, 8 * HOUR + 1800, 8 * HOUR + 2400, 8 * HOUR + 900, 8 * HOUR + 1500]),
		new Float32Array([0, 1000, 0, 1000, 0, 1000]),
		new Uint32Array([0, 2, 4]),
		new Uint32Array([2, 2, 2]),
		new Uint32Array([8 * HOUR, 8 * HOUR + 1800, 8 * HOUR + 900]),
		new Uint32Array([8 * HOUR + 600, 8 * HOUR + 2400, 8 * HOUR + 1500]),
		new Uint32Array([8 * HOUR + 600, 8 * HOUR + 2400, 8 * HOUR + 1500]),
		["Terminus", undefined, "Terminus", undefined, "Terminus", undefined],
	);

	const aller = new Trip(0, "aller", route, everyDay, store, 0, "Terminus");
	const retour = new Trip(1, "retour", route, everyDay, store, 1, "Terminus");
	const dimanche = new Trip(2, "dimanche", route, sundays, store, 0, "Terminus");
	return {
		routes: new Map([[route.id, route]]),
		stops: new Map([mairieA, mairieB, terminus].map((stop) => [stop.id, stop])),
		trips: new Map([aller, retour, dimanche].map((trip) => [trip.id, trip])),
		...indexStopAreas(store, [aller, retour, dimanche]),
		shapes: new Map(),
		journeys: new Map(),
		stopTimeStore: store,
		importedAt: Temporal.Instant.from("2026-05-18T00:00:00Z"),
		lastModified: null,
		etag: null,
	};
}

function makeSource(options?: Partial<SourceOptions>) {
	const source = new Source("test", {
		staticResourceHref: "https://example.com/gtfs.zip",
		getNetworkRef: () => "network",
		...options,
	});
	source.gtfs = makeGtfs();
	return source;
}

/** Lundi 18 mai 2026, 7h30 UTC. */
const MONDAY_MORNING = Temporal.Instant.from("2026-05-18T07:30:00Z");

/** Course `original` A 8:00 → B 8:10 → C 8:20, seule de sa source. */
function makeLinearSource() {
	const agency = new Agency("agency", "Agency", "UTC");
	const route = new Route("line:1", agency, "1", "BUS");
	const service = new Service("service", [true, true, true, true, true, true, true]);
	const stops = [new Stop("A", "A", 0, 0), new Stop("B", "B", 0, 0.01), new Stop("C", "C", 0, 0.02)];
	const store = new StopTimeStore(
		stops,
		new Uint8Array([1, 2, 3]),
		new Uint8Array([0, 0, 0]),
		new Uint32Array([8 * HOUR, 8 * HOUR + 600, 8 * HOUR + 1200]),
		new Uint32Array([8 * HOUR, 8 * HOUR + 600, 8 * HOUR + 1200]),
		new Float32Array([0, 1000, 2000]),
		new Uint32Array([0]),
		new Uint32Array([3]),
		new Uint32Array([8 * HOUR]),
		new Uint32Array([8 * HOUR + 1200]),
		new Uint32Array([8 * HOUR + 1200]),
	);
	const trip = new Trip(0, "original", route, service, store, 0, "C");

	const source = new Source("test", {
		staticResourceHref: "https://example.com/gtfs.zip",
		getNetworkRef: () => "network",
	});
	const gtfs: Gtfs = {
		routes: new Map([[route.id, route]]),
		stops: new Map(stops.map((stop) => [stop.id, stop])),
		trips: new Map([[trip.id, trip]]),
		...indexStopAreas(store, [trip]),
		shapes: new Map(),
		journeys: new Map(),
		stopTimeStore: store,
		importedAt: Temporal.Instant.from("2026-05-18T00:00:00Z"),
		lastModified: null,
		etag: null,
	};
	source.gtfs = gtfs;

	return { source, gtfs, trip };
}

describe("computeStopDepartures", () => {
	it("réunit les passages des quais d'une même station, triés et sans le terminus", () => {
		const source = makeSource();

		const { departures } = computeStopDepartures(source, "mairie-a", MONDAY_MORNING);

		expect(departures.map((departure) => departure.aimedTime)).toEqual([
			"2026-05-18T08:00:00+00:00",
			"2026-05-18T08:30:00+00:00",
		]);
		expect(departures.map((departure) => departure.stopRef)).toEqual([
			"network:StopPoint:mairie-a",
			"network:StopPoint:mairie-b",
		]);
		expect(departures.map((departure) => departure.platformName)).toEqual(["A", "B"]);
		expect(departures[0]!.lineRef).toBe("network:Line:line:1");
		expect(departures[0]!.destination).toBe("Terminus");
		// Mairie est le premier arrêt de chaque course : ce sont des départs de terminus.
		expect(departures.every((departure) => departure.origin)).toBe(true);
	});

	it("écarte les courses dont le service ne circule pas ce jour-là", () => {
		const source = makeSource();

		const { departures } = computeStopDepartures(source, "mairie-a", MONDAY_MORNING);

		expect(departures.some((departure) => departure.journeyRef?.endsWith("dimanche"))).toBe(false);

		const sunday = Temporal.Instant.from("2026-05-24T07:30:00Z");
		const { departures: sundayDepartures } = computeStopDepartures(source, "mairie-a", sunday);

		expect(sundayDepartures.map((departure) => departure.aimedTime)).toEqual([
			"2026-05-24T08:00:00+00:00",
			"2026-05-24T08:15:00+00:00",
			"2026-05-24T08:30:00+00:00",
		]);
	});

	it("applique le temps réel de la course lorsqu'elle en porte", () => {
		const source = makeSource();
		const gtfs = source.gtfs!;
		const date = Temporal.PlainDate.from("2026-05-18");
		const journey = gtfs.trips.get("aller")!.getScheduledJourney(date, true);
		journey.updateJourney(gtfs, [{ stopId: "mairie-a", stopSequence: 1, departure: { delay: 300 } }]);
		gtfs.journeys.set(getJourneyKey(date, "aller"), journey);

		const { departures } = computeStopDepartures(source, "mairie-a", MONDAY_MORNING);

		expect(departures[0]!.aimedTime).toBe("2026-05-18T08:00:00+00:00");
		expect(departures[0]!.expectedTime).toBe("2026-05-18T08:05:00+00:00");
	});

	it("remonte l'identifiant de publication d'une course déjà suivie", () => {
		const source = makeSource();
		const gtfs = source.gtfs!;
		const date = Temporal.PlainDate.from("2026-05-18");
		const journey = gtfs.trips.get("aller")!.getScheduledJourney(date, true);
		journey.updateJourney(gtfs, [{ stopId: "mairie-a", stopSequence: 1, departure: { delay: 60 } }]);
		journey.lastPublishedKey = "network::ServiceJourney:aller/1:2026-05-18";
		gtfs.journeys.set(getJourneyKey(date, "aller"), journey);

		const { departures } = computeStopDepartures(source, "mairie-a", MONDAY_MORNING);

		expect(departures[0]!.journeyId).toBe("network::ServiceJourney:aller_1:2026-05-18");
	});

	it("ne renvoie rien au-delà de la portée demandée", () => {
		const source = makeSource();

		const { departures } = computeStopDepartures(source, "mairie-a", MONDAY_MORNING, {
			horizonMs: 15 * 60 * 1000,
		});

		expect(departures).toHaveLength(0);
	});

	it("respecte mapStopRef et mapLineRef", () => {
		const source = makeSource({
			mapStopRef: (stopRef) => `S-${stopRef}`,
			mapLineRef: (lineRef) => `L-${lineRef}`,
		});

		const { departures } = computeStopDepartures(source, "mairie-a", MONDAY_MORNING);

		expect(departures[0]!.stopRef).toBe("network:StopPoint:S-mairie-a");
		expect(departures[0]!.lineRef).toBe("network:Line:L-line:1");
	});

	it("présente la destination résolue par getDestination, véhicule compris", () => {
		const source = makeSource({
			getDestination: (journey, vehicle) => vehicle?.label ?? `Direction ${journey?.trip.id}`,
		});
		const gtfs = source.gtfs!;
		const date = Temporal.PlainDate.from("2026-05-18");
		const journey = gtfs.trips.get("aller")!.getScheduledJourney(date, true);
		// La validité du descripteur se mesure à l'horloge réelle, pas à l'instant simulé du test.
		journey.setVehicleDescriptor({ id: "412", label: "Hôtel de Ville" }, Date.now());
		gtfs.journeys.set(getJourneyKey(date, "aller"), journey);

		const { departures } = computeStopDepartures(source, "mairie-a", MONDAY_MORNING);

		// Course suivie : le libellé du véhicule l'emporte.
		expect(departures[0]!.destination).toBe("Hôtel de Ville");
		// Course sans état : une course temporaire est fabriquée pour interroger la configuration.
		expect(departures[1]!.destination).toBe("Direction retour");
	});

	it("restreint le tableau au quai demandé", () => {
		const { departures } = computeStopDepartures(makeSource(), "mairie-a", MONDAY_MORNING, {
			stopRef: "network:StopPoint:mairie-b",
		});

		expect(departures.map((departure) => departure.stopRef)).toEqual(["network:StopPoint:mairie-b"]);
		expect(departures[0]!.aimedTime).toBe("2026-05-18T08:30:00+00:00");
	});

	it("présente au tableau du quai désigné par le temps réel la course qui dessert la zone d'arrêt", () => {
		// La course dessert une zone d'arrêt sans voie ; la voie 2, qu'aucune course ne dessert, n'est
		// rattachée à la gare que par sa `parent_station`.
		const agency = new Agency("agency", "Agency", "UTC");
		const route = new Route("line:1", agency, "1", "RAIL");
		const service = new Service("service", [true, true, true, true, true, true, true]);
		const zone = new Stop("zone", "Gare", 0, 0, undefined, undefined, "gare");
		const voie2 = new Stop("voie-2", "Gare", 0, 0.0001, "2", undefined, "gare");
		const terminus = new Stop("terminus", "Terminus", 0, 0.02);
		const store = new StopTimeStore(
			[zone, terminus],
			new Uint8Array([1, 2]),
			new Uint8Array([0, 0]),
			new Uint32Array([8 * HOUR, 8 * HOUR + 600]),
			new Uint32Array([8 * HOUR, 8 * HOUR + 600]),
			new Float32Array([0, 1000]),
			new Uint32Array([0]),
			new Uint32Array([2]),
			new Uint32Array([8 * HOUR]),
			new Uint32Array([8 * HOUR + 600]),
			new Uint32Array([8 * HOUR + 600]),
		);
		const trip = new Trip(0, "train", route, service, store, 0, "Terminus");
		const stations = new Map([
			["gare", { id: "gare", name: "Gare", latitude: 0, longitude: 0, platforms: [zone, voie2] }],
		]);

		const source = new Source("test", {
			staticResourceHref: "https://example.com/gtfs.zip",
			getNetworkRef: () => "network",
		});
		const gtfs: Gtfs = {
			routes: new Map([[route.id, route]]),
			stops: new Map([zone, voie2, terminus].map((stop) => [stop.id, stop])),
			trips: new Map([[trip.id, trip]]),
			...indexStopAreas(store, [trip], stations),
			shapes: new Map(),
			journeys: new Map(),
			stopTimeStore: store,
			importedAt: Temporal.Instant.from("2026-05-18T00:00:00Z"),
			lastModified: null,
			etag: null,
		};
		source.gtfs = gtfs;

		expect(gtfs.stopAreas.get("gare")!.stops.map(({ id }) => id)).toEqual(["voie-2", "zone"]);

		const onVoie2 = () =>
			computeStopDepartures(source, "gare", MONDAY_MORNING, { stopRef: "network:StopPoint:voie-2" }).departures;
		const onZone = () =>
			computeStopDepartures(source, "gare", MONDAY_MORNING, { stopRef: "network:StopPoint:zone" }).departures;

		// Sans voie désignée, la course reste au tableau de la zone d'arrêt.
		expect(onVoie2()).toEqual([]);
		expect(onZone()).toHaveLength(1);

		const date = Temporal.PlainDate.from("2026-05-18");
		const journey = trip.getScheduledJourney(date, true);
		// Le tableau ne consulte que les courses portant des heures temps réel, que le flux fournit
		// toujours avec la voie.
		journey.updateJourney(gtfs, [
			{ stopId: "zone", stopSequence: 1, departure: { delay: 60 }, stopTimeProperties: { assignedStopId: "voie-2" } },
		]);
		gtfs.journeys.set(getJourneyKey(date, "train"), journey);

		expect(onVoie2()).toMatchObject([{ stopRef: "network:StopPoint:voie-2", platformName: "2" }]);
		expect(onZone()).toEqual([]);
		// Le tableau de la gare la présente une seule fois, sur sa voie.
		expect(computeStopDepartures(source, "gare", MONDAY_MORNING).departures).toMatchObject([
			{ stopRef: "network:StopPoint:voie-2", platformName: "2" },
		]);
	});

	it("écarte les passages refusés par filterStopDeparture, avant la limite, et en signale la course", () => {
		const source = makeSource({
			filterStopDeparture: (departure, journey) =>
				departure.stopRef !== "network:StopPoint:mairie-a" && journey.trip.id === "retour",
		});

		const { departures, excludedJourneys } = computeStopDepartures(source, "mairie-a", MONDAY_MORNING, { limit: 1 });

		expect(departures.map((departure) => departure.journeyRef)).toEqual(["network:ServiceJourney:retour"]);
		expect(excludedJourneys).toEqual([
			{ journeyId: undefined, journeyRef: "network:ServiceJourney:aller", serviceDate: "2026-05-18" },
		]);
	});

	it("renvoie une liste vide pour une station inconnue", () => {
		expect(computeStopDepartures(makeSource(), "inexistante", MONDAY_MORNING).departures).toEqual([]);
	});

	it("présente les dessertes d'un arrêt créé à la volée par une déviation", () => {
		const { source, gtfs, trip } = makeLinearSource();

		// B est remplacé par un arrêt que seul le flux temps réel déclare.
		const resources = createRealtimeResources();
		const replacement = new Stop("RT", "Arrêt provisoire", 0.001, 0.01);
		resources.stops.set(replacement.id, replacement);
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
							replacementStops: [{ stopId: "RT", travelTimeToStop: 300 }],
						},
					],
				},
			],
			resources,
		).get("2026-05-18-original")!;

		const date = Temporal.PlainDate.from("2026-05-18");
		const journeyKey = getJourneyKey(date, "original");
		const journey = trip.getScheduledJourney(date, true);
		journey.applyModifications(plan, MONDAY_MORNING.epochMilliseconds);
		gtfs.journeys.set(journeyKey, journey);
		source.modifiedJourneyKeys.add(journeyKey);
		source.realtimeStopAreas.set("RT", new StopArea("RT", replacement.name, 0.001, 0.01, [replacement]));

		const { departures } = computeStopDepartures(source, "RT", MONDAY_MORNING);

		expect(departures).toHaveLength(1);
		expect(departures[0]).toMatchObject({ stopRef: "network:StopPoint:RT", callStatus: "UNSCHEDULED", origin: false });
		// L'arrêt remplacé reste annoncé, comme supprimé : le voyageur qui l'attend doit le savoir.
		expect(computeStopDepartures(source, "B", MONDAY_MORNING).departures).toMatchObject([
			{ stopRef: "network:StopPoint:B", callStatus: "SKIPPED" },
		]);
	});

	it("n'annonce pas la course à son terminus effectif, avancé par le temps réel", () => {
		const { source, gtfs, trip } = makeLinearSource();
		const date = Temporal.PlainDate.from("2026-05-18");
		const journey = trip.getScheduledJourney(date, true);
		// C n'est plus desservi : la course s'achève à B.
		journey.updateJourney(gtfs, [
			{ stopId: "B", stopSequence: 2, departure: { delay: 60 } },
			{ stopId: "C", stopSequence: 3, scheduleRelationship: "SKIPPED" },
		]);
		gtfs.journeys.set(getJourneyKey(date, "original"), journey);

		expect(computeStopDepartures(source, "B", MONDAY_MORNING).departures).toEqual([]);
		expect(computeStopDepartures(source, "A", MONDAY_MORNING).departures).toHaveLength(1);
	});

	it("n'annonce pas la course à son terminus effectif, avancé par une déviation", () => {
		const { source, gtfs, trip } = makeLinearSource();
		const plan = indexTripModifications(
			gtfs,
			[
				{
					id: "detour:1",
					serviceDates: ["20260518"],
					selectedTrips: [{ tripIds: ["original"] }],
					modifications: [{ startStopSelector: { stopSequence: 3 }, endStopSelector: { stopSequence: 3 } }],
				},
			],
			createRealtimeResources(),
		).get("2026-05-18-original")!;

		const date = Temporal.PlainDate.from("2026-05-18");
		const journeyKey = getJourneyKey(date, "original");
		const journey = trip.getScheduledJourney(date, true);
		journey.applyModifications(plan, MONDAY_MORNING.epochMilliseconds);
		gtfs.journeys.set(journeyKey, journey);
		source.modifiedJourneyKeys.add(journeyKey);

		expect(computeStopDepartures(source, "B", MONDAY_MORNING).departures).toEqual([]);
		expect(computeStopDepartures(source, "C", MONDAY_MORNING).departures).toEqual([]);
	});

	it("préfixe chaque passage du réseau de sa course lorsque la source en alimente plusieurs", () => {
		const source = makeSource({
			// Réseau propre à chaque course, à la manière de la SNCF et de ses exploitants.
			getNetworkRef: (journey) => (journey?.trip.id === "retour" ? "network-b" : "network-a"),
		});

		const { departures } = computeStopDepartures(source, "mairie-a", MONDAY_MORNING);

		expect(departures.map(({ stopRef, lineRef }) => [stopRef, lineRef])).toEqual([
			["network-a:StopPoint:mairie-a", "network-a:Line:line:1"],
			["network-b:StopPoint:mairie-b", "network-b:Line:line:1"],
		]);

		// Un quai se désigne sous la référence de n'importe lequel de ses réseaux.
		const { departures: platform } = computeStopDepartures(source, "mairie-a", MONDAY_MORNING, {
			stopRef: "network-a:StopPoint:mairie-b",
		});
		expect(platform.map(({ stopRef }) => stopRef)).toEqual(["network-b:StopPoint:mairie-b"]);
	});
});

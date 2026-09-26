import { describe, expect, it } from "vitest";

import { indexStopAreas } from "../import/import-gtfs.js";
import { Agency } from "../model/agency.js";
import type { Gtfs } from "../model/gtfs.js";
import type { IdentifiedAlert } from "../model/gtfs-rt.js";
import { Route } from "../model/route.js";
import { Service } from "../model/service.js";
import { Source, type SourceOptions } from "../model/source.js";
import { Stop } from "../model/stop.js";
import { StopTimeStore } from "../model/stop-time-store.js";
import { Trip } from "../model/trip.js";

import { buildServiceAlerts } from "./publish-service-alerts.js";

const HOUR = 3600;

/** 18 mai 2026, 7h30 UTC. */
const NOW = Temporal.Instant.from("2026-05-18T07:30:00Z");
const NOW_SECS = NOW.epochMilliseconds / 1000;

/**
 * Ligne `TCAR:15` : une course de la station « Martainville » (quais A et B, rattachés à la station
 * `TCAR:MARTA`) vers « Terminus ».
 */
function makeGtfs(): Gtfs {
	const agency = new Agency("TCAR", "TCAR", "UTC");
	const route = new Route("TCAR:15", agency, "15", "BUS");
	const everyDay = new Service("every-day", [true, true, true, true, true, true, true]);

	const martaA = new Stop("TCAR:MARTA1", "Martainville", 0, 0, "A", undefined, "TCAR:MARTA");
	const martaB = new Stop("TCAR:MARTA2", "Martainville", 0, 0.0005, "B", undefined, "TCAR:MARTA");
	const terminus = new Stop("TCAR:TERM", "Terminus", 0, 0.02);

	const stops = [martaA, terminus, martaB, terminus];
	const store = new StopTimeStore(
		stops,
		new Uint8Array([1, 2, 1, 2]),
		new Uint8Array([0, 0, 0, 0]),
		new Uint32Array([8 * HOUR, 8 * HOUR + 600, 9 * HOUR, 9 * HOUR + 600]),
		new Uint32Array([8 * HOUR, 8 * HOUR + 600, 9 * HOUR, 9 * HOUR + 600]),
		new Float32Array([0, 1000, 0, 1000]),
		new Uint32Array([0, 2]),
		new Uint32Array([2, 2]),
		new Uint32Array([8 * HOUR, 9 * HOUR]),
		new Uint32Array([8 * HOUR + 600, 9 * HOUR + 600]),
		new Uint32Array([8 * HOUR + 600, 9 * HOUR + 600]),
		["Terminus", undefined, "Terminus", undefined],
	);

	const aller = new Trip(0, "TCAR:aller", route, everyDay, store, 0, "Terminus");
	const retour = new Trip(1, "TCAR:retour", route, everyDay, store, 0, "Terminus");
	const stations = new Map([
		["TCAR:MARTA", { id: "TCAR:MARTA", name: "Martainville", latitude: 0, longitude: 0, platforms: [martaA, martaB] }],
	]);

	return {
		routes: new Map([[route.id, route]]),
		stops: new Map([martaA, martaB, terminus].map((stop) => [stop.id, stop])),
		trips: new Map([aller, retour].map((trip) => [trip.id, trip])),
		...indexStopAreas(store, [aller, retour], stations),
		shapes: new Map(),
		journeys: new Map(),
		stopTimeStore: store,
		importedAt: NOW,
		lastModified: null,
		etag: null,
	};
}

function makeSource(options?: Partial<SourceOptions>) {
	const source = new Source("tcar", {
		staticResourceHref: "https://example.com/gtfs.zip",
		getNetworkRef: () => "ASTUCE",
		mapLineRef: (lineRef) => lineRef.replace("TCAR:", ""),
		...options,
	});
	source.gtfs = makeGtfs();
	return source;
}

const text = (value: string) => ({ translation: [{ text: value, language: "fr" }] });

function makeAlert(alert: Partial<IdentifiedAlert>): IdentifiedAlert {
	return { id: "SA:1", headerText: text("Déviation"), ...alert };
}

describe("buildServiceAlerts", () => {
	it("désigne une ligne dans un sens, sous sa référence publiée", () => {
		const [alert] = buildServiceAlerts(
			makeSource(),
			[
				makeAlert({
					activePeriod: [{ start: NOW_SECS - 3600, end: NOW_SECS + 3600 }],
					informedEntity: [{ agencyId: "TCAR", routeId: "TCAR:15", directionId: 0 }],
					cause: "CONSTRUCTION",
					effect: "DETOUR",
					descriptionText: text("<p>Arrêt non desservi</p>"),
					url: text("https://example.com/15.pdf"),
				}),
			],
			NOW,
		);

		expect(alert).toEqual({
			id: "tcar:SA:1",
			cause: "CONSTRUCTION",
			effect: "DETOUR",
			activePeriods: [
				{
					start: Temporal.Instant.fromEpochMilliseconds((NOW_SECS - 3600) * 1000).toString(),
					end: Temporal.Instant.fromEpochMilliseconds((NOW_SECS + 3600) * 1000).toString(),
				},
			],
			header: [{ text: "Déviation", language: "fr" }],
			description: [{ text: "<p>Arrêt non desservi</p>", language: "fr" }],
			url: [{ text: "https://example.com/15.pdf", language: "fr" }],
			informedEntities: [{ networkRef: "ASTUCE", lineRef: "ASTUCE:Line:15", direction: "OUTBOUND" }],
		});
	});

	it("désigne un quai par sa référence de quai", () => {
		const [alert] = buildServiceAlerts(
			makeSource(),
			[makeAlert({ informedEntity: [{ agencyId: "TCAR", stopId: "TCAR:MARTA1" }] })],
			NOW,
		);

		expect(alert?.informedEntities).toEqual([{ networkRef: "ASTUCE", stopRef: "ASTUCE:StopPoint:TCAR:MARTA1" }]);
	});

	it("désigne une station et chacun de ses quais", () => {
		const [alert] = buildServiceAlerts(makeSource(), [makeAlert({ informedEntity: [{ stopId: "TCAR:MARTA" }] })], NOW);

		expect(alert?.informedEntities).toEqual([
			{ networkRef: "ASTUCE", stopAreaRef: "ASTUCE:StopArea:TCAR:MARTA" },
			{ networkRef: "ASTUCE", stopRef: "ASTUCE:StopPoint:TCAR:MARTA1" },
			{ networkRef: "ASTUCE", stopRef: "ASTUCE:StopPoint:TCAR:MARTA2" },
		]);
	});

	it("combine ligne et arrêt d'une même entité", () => {
		const [alert] = buildServiceAlerts(
			makeSource(),
			[makeAlert({ informedEntity: [{ routeId: "TCAR:15", stopId: "TCAR:MARTA2" }] })],
			NOW,
		);

		expect(alert?.informedEntities).toEqual([
			{ networkRef: "ASTUCE", lineRef: "ASTUCE:Line:15", stopRef: "ASTUCE:StopPoint:TCAR:MARTA2" },
		]);
	});

	it("désigne une course datée", () => {
		const [alert] = buildServiceAlerts(
			makeSource(),
			[makeAlert({ informedEntity: [{ trip: { tripId: "TCAR:aller", startDate: "20260518" } }] })],
			NOW,
		);

		expect(alert?.informedEntities).toEqual([
			{ networkRef: "ASTUCE", journeyRef: "ASTUCE:ServiceJourney:TCAR:aller", serviceDate: "2026-05-18" },
		]);
	});

	it("désigne tout le réseau lorsque seule l'agence est visée", () => {
		const [alert] = buildServiceAlerts(makeSource(), [makeAlert({ informedEntity: [{ agencyId: "TCAR" }] })], NOW);

		expect(alert?.informedEntities).toEqual([{ networkRef: "ASTUCE" }]);
	});

	it("écarte une alerte dont toutes les périodes sont échues", () => {
		const alerts = buildServiceAlerts(
			makeSource(),
			[
				makeAlert({
					activePeriod: [{ start: NOW_SECS - 7200, end: NOW_SECS - 3600 }],
					informedEntity: [{ routeId: "TCAR:15" }],
				}),
			],
			NOW,
		);

		expect(alerts).toEqual([]);
	});

	it("garde une alerte à venir, que le serveur n'affichera qu'à son début", () => {
		const alerts = buildServiceAlerts(
			makeSource(),
			[makeAlert({ activePeriod: [{ start: NOW_SECS + 3600 }], informedEntity: [{ routeId: "TCAR:15" }] })],
			NOW,
		);

		expect(alerts).toHaveLength(1);
	});

	it("écarte une alerte qui ne désigne qu'un type de route ou une course inconnue", () => {
		const alerts = buildServiceAlerts(
			makeSource(),
			[
				makeAlert({ id: "SA:1", informedEntity: [{ routeType: 3 }] }),
				makeAlert({ id: "SA:2", informedEntity: [{ trip: { tripId: "TCAR:inconnue" } }] }),
			],
			NOW,
		);

		expect(alerts).toEqual([]);
	});

	it("écarte les valeurs d'énumération que le contrat ne connaît pas", () => {
		const [known, unknown] = buildServiceAlerts(
			makeSource(),
			[
				makeAlert({ id: "SA:1", informedEntity: [{ routeId: "TCAR:15" }], cause: "SPECIAL_EVENT", effect: "DETOUR" }),
				makeAlert({
					id: "SA:2",
					informedEntity: [{ routeId: "TCAR:15" }],
					// Valeurs ajoutées à la spec après les bindings : décodées en nombres.
					cause: 99 as never,
					effect: 99 as never,
					severityLevel: 99 as never,
				}),
			],
			NOW,
		);

		expect(known).toMatchObject({ cause: "SPECIAL_EVENT", effect: "DETOUR" });
		expect(unknown).toMatchObject({ effect: "UNKNOWN_EFFECT" });
		expect(unknown).not.toHaveProperty("cause");
		expect(unknown).not.toHaveProperty("severity");
	});
});

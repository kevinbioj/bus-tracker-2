import { describe, expect, it } from "vitest";

import { Agency } from "./agency.js";
import type { Gtfs } from "./gtfs.js";
import type { StopTimeUpdate } from "./gtfs-rt.js";
import { Route } from "./route.js";
import { Service } from "./service.js";
import { Shape } from "./shape.js";
import { Stop } from "./stop.js";
import { StopTimeStore } from "./stop-time-store.js";
import { Trip } from "./trip.js";

const DATE = Temporal.PlainDate.from("2026-06-01");

function at(time: string) {
	return Temporal.Instant.from(`2026-06-01T${time}Z`);
}

/**
 * Trois arrêts alignés sur une shape rectiligne, avec un temps d'arrêt à B pour pouvoir
 * exercer la branche « à quai » :
 *
 * A (0 m, 8:00 → 8:00) ── B (1000 m, 8:10 → 8:12) ── C (2000 m, 8:20)
 */
function makeShapedGtfs(options?: { withDistances?: boolean }) {
	const agency = new Agency("agency", "Agency", "UTC");
	const route = new Route("route", agency, "1", "BUS");
	const service = new Service("service");
	const shape = new Shape("shape", new Float64Array([0, 0, 0, 0, 0.01, 1000, 0, 0.02, 2000]));
	const stops = [new Stop("A", "A", 0, 0), new Stop("B", "B", 0, 0.01), new Stop("C", "C", 0, 0.02)];
	const store = new StopTimeStore(
		stops,
		new Uint8Array([1, 2, 3]),
		new Uint8Array([0, 0, 0]),
		new Uint32Array([8 * 3600, 8 * 3600 + 10 * 60, 8 * 3600 + 20 * 60]),
		new Uint32Array([8 * 3600, 8 * 3600 + 12 * 60, 8 * 3600 + 20 * 60]),
		options?.withDistances === false
			? new Float32Array([Number.NaN, Number.NaN, Number.NaN])
			: new Float32Array([0, 1000, 2000]),
		new Uint32Array([0]),
		new Uint32Array([3]),
		new Uint32Array([8 * 3600]),
		new Uint32Array([8 * 3600 + 20 * 60]),
		new Uint32Array([8 * 3600 + 20 * 60]),
	);
	const trip = new Trip(0, "trip", route, service, store, 0, "Terminus", undefined, shape);
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

/** Retard appliqué à partir de l'arrêt donné — updateJourney le propage aux arrêts suivants. */
function delayFrom(stopId: string, stopSequence: number, delaySeconds: number): StopTimeUpdate {
	return {
		stopId,
		stopSequence,
		arrival: { delay: delaySeconds },
		departure: { delay: delaySeconds },
	};
}

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

describe("Journey#guessPosition (guard anti-recul)", () => {
	it("laisse la position progresser normalement sans temps réel", () => {
		const { trip } = makeShapedGtfs();
		const journey = trip.getScheduledJourney(DATE, true);

		const distances = ["08:02:00", "08:05:00", "08:08:00"].map(
			(time) => journey.guessPosition(at(time)).distanceTraveled,
		);

		expect(distances).toEqual([200, 500, 800]);
	});

	it("gèle la position quand un retard révisé à la hausse la ferait reculer", () => {
		const { gtfs, trip } = makeShapedGtfs();
		const journey = trip.getScheduledJourney(DATE, true);

		const frozen = journey.guessPosition(at("08:05:00"));
		expect(frozen.distanceTraveled).toBe(500);

		// +2 min à B : le prochain arrêt s'éloigne, le calcul brut retomberait à ~458 m.
		journey.updateJourney(gtfs, [delayFrom("B", 2, 120)]);

		expect(journey.guessPosition(at("08:05:30"))).toEqual(frozen);
	});

	it("repart dès que le calcul rattrape la position gelée", () => {
		const { gtfs, trip } = makeShapedGtfs();
		const journey = trip.getScheduledJourney(DATE, true);

		journey.guessPosition(at("08:05:00"));
		journey.updateJourney(gtfs, [delayFrom("B", 2, 120)]);
		journey.guessPosition(at("08:05:30"));

		const resumed = journey.guessPosition(at("08:07:00"));
		expect(resumed.distanceTraveled).toBeGreaterThan(500);
		expect(journey.guessPosition(at("08:08:00")).distanceTraveled).toBeGreaterThan(resumed.distanceTraveled!);
	});

	it("accepte un recul dont le rattrapage prendrait plus de 5 minutes", () => {
		const { gtfs, trip } = makeShapedGtfs();
		const journey = trip.getScheduledJourney(DATE, true);

		journey.guessPosition(at("08:05:00"));

		// +20 min à B : valeur suspecte, il faudrait figer le véhicule ~9 min.
		journey.updateJourney(gtfs, [delayFrom("B", 2, 20 * 60)]);
		const accepted = journey.guessPosition(at("08:05:30"));
		expect(accepted.distanceTraveled).toBeLessThan(500);

		// Le guard doit s'être ré-ancré sur la nouvelle valeur : un petit recul redevient gelé.
		journey.updateJourney(gtfs, [delayFrom("B", 2, 25 * 60)]);
		expect(journey.guessPosition(at("08:06:00"))).toEqual(accepted);
	});

	it("libère la position au bout de 5 minutes de gel continu", () => {
		const { gtfs, trip } = makeShapedGtfs();
		const journey = trip.getScheduledJourney(DATE, true);

		expect(journey.guessPosition(at("08:05:00")).distanceTraveled).toBe(500);

		// Le retard monte par paliers de 3 min : chaque cycle voit un rattrapage < 5 min et regèle.
		const distances: (number | undefined)[] = [];
		let delaySeconds = 0;
		for (const time of ["08:05:30", "08:07:00", "08:08:30", "08:10:00", "08:11:30"]) {
			delaySeconds += 3 * 60;
			journey.updateJourney(gtfs, [delayFrom("B", 2, delaySeconds)]);
			distances.push(journey.guessPosition(at(time)).distanceTraveled);
		}

		expect(distances.slice(0, 4)).toEqual([500, 500, 500, 500]);
		expect(distances[4]).toBeLessThan(500);
	});

	it("empêche un véhicule à quai d'être téléporté à l'arrêt précédent", () => {
		const { gtfs, trip } = makeShapedGtfs();
		const journey = trip.getScheduledJourney(DATE, true);

		const atStop = journey.guessPosition(at("08:11:00"));
		expect(atStop).toMatchObject({ atStop: true, distanceTraveled: 1000, longitude: 0.01 });

		// +3 min à B : l'arrêt courant repasse dans le futur, l'index retomberait sur A.
		journey.updateJourney(gtfs, [delayFrom("B", 2, 180)]);

		expect(journey.guessPosition(at("08:11:30"))).toEqual(atStop);
	});

	it("empêche un véhicule parti d'être ramené à son terminus de départ", () => {
		const { gtfs, trip } = makeShapedGtfs();
		const journey = trip.getScheduledJourney(DATE, true);

		const departed = journey.guessPosition(at("08:00:30"));
		expect(departed.distanceTraveled).toBe(50);

		// +2 min au premier arrêt : le départ repasse dans le futur.
		journey.updateJourney(gtfs, [delayFrom("A", 1, 120)]);

		expect(journey.guessPosition(at("08:01:00"))).toEqual(departed);
	});

	it("ancre la position sur le terminus une fois la course terminée", () => {
		const { trip } = makeShapedGtfs();
		const journey = trip.getScheduledJourney(DATE, true);

		expect(journey.guessPosition(at("08:25:00"))).toMatchObject({ atStop: true, distanceTraveled: 2000 });
	});

	it("gèle quand la perte du temps réel ferait reculer un véhicule en avance", () => {
		const { gtfs, trip } = makeShapedGtfs();
		const journey = trip.getScheduledJourney(DATE, true);

		// 2 min d'avance : le véhicule est plus loin que ne le dit l'horaire théorique.
		journey.updateJourney(gtfs, [delayFrom("B", 2, -120)]);
		const frozen = journey.guessPosition(at("08:06:00"));
		expect(frozen.distanceTraveled).toBe(750);

		// Le flux ne contient plus cette course : retour à l'horaire théorique, la position reculerait.
		journey.updateJourney(gtfs, []);
		expect(journey.guessPosition(at("08:06:10"))).toEqual(frozen);
	});

	it("reste opérant lorsqu'un arrêt devient SKIPPED", () => {
		const { gtfs, trip } = makeShapedGtfs();
		const journey = trip.getScheduledJourney(DATE, true);

		const frozen = journey.guessPosition(at("08:15:00"));
		expect(frozen.distanceTraveled).toBe(1375);

		journey.updateJourney(gtfs, [
			{ stopId: "B", stopSequence: 2, scheduleRelationship: "SKIPPED" },
			delayFrom("C", 3, 5 * 60),
		]);

		expect(journey.guessPosition(at("08:15:30"))).toEqual(frozen);
	});

	it("retrouve le bon segment quand le calcul recule de plus d'un inter-arrêt", () => {
		const { gtfs, trip } = makeShapedGtfs();
		const journey = trip.getScheduledJourney(DATE, true);

		expect(journey.guessPosition(at("08:15:00")).distanceTraveled).toBe(1375);

		// +6 min à B : le calcul retombe entre A et B, soit un rattrapage estimé sur le segment B→C
		// de plus de 5 minutes — le recul est donc accepté.
		journey.updateJourney(gtfs, [delayFrom("B", 2, 6 * 60)]);
		const accepted = journey.guessPosition(at("08:15:30"));
		expect(accepted.distanceTraveled).toBeLessThan(1000);
	});

	it("abandonne un état gelé plus vieux que 3 minutes", () => {
		const { gtfs, trip } = makeShapedGtfs();
		const journey = trip.getScheduledJourney(DATE, true);

		journey.guessPosition(at("08:05:00"));
		journey.updateJourney(gtfs, [delayFrom("B", 2, 10 * 60)]);

		// Un cycle 2 min 30 plus tard gèle...
		expect(journey.guessPosition(at("08:07:30")).distanceTraveled).toBe(500);

		const stale = makeShapedGtfs();
		const staleJourney = stale.trip.getScheduledJourney(DATE, true);
		staleJourney.guessPosition(at("08:05:00"));
		staleJourney.updateJourney(stale.gtfs, [delayFrom("B", 2, 10 * 60)]);

		// ...mais 4 min plus tard, l'état est périmé (le véhicule a pu passer en position GPS entretemps).
		expect(staleJourney.guessPosition(at("08:09:00")).distanceTraveled).toBeLessThan(500);
	});

	it("reste inopérant sur une course sans distances curvilignes", () => {
		const { gtfs, trip } = makeShapedGtfs({ withDistances: false });
		const journey = trip.getScheduledJourney(DATE, true);

		expect(journey.guessPosition(at("08:15:00"))).toMatchObject({
			atStop: true,
			longitude: 0.01,
			distanceTraveled: undefined,
		});

		journey.updateJourney(gtfs, [delayFrom("B", 2, 6 * 60)]);

		// Sans distance, deux positions ne sont pas comparables : le comportement reste celui d'avant.
		expect(journey.guessPosition(at("08:15:30"))).toMatchObject({
			atStop: true,
			longitude: 0,
			distanceTraveled: undefined,
		});
	});

	it("oublie l'état gelé une fois la course terminée", () => {
		const { gtfs, trip } = makeShapedGtfs();
		const journey = trip.getScheduledJourney(DATE, true);

		journey.updateJourney(gtfs, [delayFrom("B", 2, 120)]);
		journey.guessPosition(at("08:05:00"));
		journey.releaseUnmodifiedCalls(at("09:00:00").epochMilliseconds);

		// L'état a été libéré : la position suivante est publiée telle quelle, sans gel.
		expect(journey.guessPosition(at("08:05:30")).distanceTraveled).toBeLessThan(500);
	});
});

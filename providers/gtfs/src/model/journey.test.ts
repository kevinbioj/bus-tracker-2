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
import type { TripModificationPlan } from "./trip-modification.js";

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
function makeShapedGtfs(options?: { withDistances?: boolean; withShapeDistances?: boolean }) {
	const agency = new Agency("agency", "Agency", "UTC");
	const route = new Route("route", agency, "1", "BUS");
	const service = new Service("service");
	// `shape_dist_traveled` est absent de nombreux shapes.txt : les distances valent alors NaN.
	const shape =
		options?.withShapeDistances === false
			? new Shape("shape", new Float64Array([0, 0, Number.NaN, 0, 0.01, Number.NaN, 0, 0.02, Number.NaN]))
			: new Shape("shape", new Float64Array([0, 0, 0, 0, 0.01, 1000, 0, 0.02, 2000]));
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
		shapes: new Map(trip.shape !== undefined ? [[trip.shape.id, trip.shape]] : []),
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
		shapes: new Map(trip.shape !== undefined ? [[trip.shape.id, trip.shape]] : []),
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

	it("ne tient pas pour suivie une course dont une déviation n'a fait qu'ajouter des arrêts", () => {
		const { gtfs, trip } = makeGtfs();
		const journey = trip.getScheduledJourney(DATE, true);

		journey.applyModifications(
			{
				modificationsIds: ["detour:1"],
				tripId: "trip",
				date: DATE,
				revision: "rev:1",
				modifications: [
					{
						startStopSelector: { stopSequence: 2 },
						propagatedModificationDelayMs: 0,
						replacementStops: [{ stop: gtfs.stops.get("X")!, travelTimeToStopMs: 5 * 60 * 1000 }],
					},
				],
			},
			at("08:00").epochMilliseconds,
		);

		expect(journey.calls.map((call) => call.stop.id)).toEqual(["A", "X", "B"]);
		// L'heure de l'arrêt ajouté vient de la déviation, pas d'une prédiction : sans quoi les sources
		// en mode `NO-TU` cesseraient de publier la course au seul motif qu'elle est déviée.
		expect(journey.hasRealtime()).toBe(false);

		// La déviation renumérote les arrêts : B porte désormais la séquence 3.
		journey.updateJourney(gtfs, [delayFrom("B", 3, 120)]);

		expect(journey.hasRealtime()).toBe(true);
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

describe("Journey#shape", () => {
	/**
	 * Tracé de remplacement tel qu'en publient les producteurs : la déviation (A → X), puis le retour
	 * en ligne droite sur l'itinéraire d'origine, qu'il suit jusqu'au terminus (B → C) alors que la
	 * course n'y dessert plus rien.
	 */
	const detourShape = new Shape(
		"shape:detour",
		new Float64Array([0, 0, 0, 0.01, 0.005, 1300, 0, 0.01, 2700, 0, 0.02, 3700]),
	);

	/** Retire B et C — donc jusqu'au terminus — au profit d'un arrêt de déviation. */
	const plan: TripModificationPlan = {
		modificationsIds: ["detour:1"],
		tripId: "trip",
		date: DATE,
		shape: detourShape,
		revision: "rev:1",
		modifications: [
			{
				startStopSelector: { stopSequence: 2 },
				endStopSelector: { stopSequence: 3 },
				propagatedModificationDelayMs: 0,
				replacementStops: [{ stop: new Stop("X", "Déviation", 0.01, 0.005), travelTimeToStopMs: 5 * 60 * 1000 }],
			},
		],
	};

	it("rogne le tracé de remplacement au dernier arrêt desservi", () => {
		const { trip } = makeShapedGtfs();
		const journey = trip.getScheduledJourney(DATE, true);

		journey.applyModifications(plan, at("08:00").epochMilliseconds);

		// Le retour vers l'ancien terminus est abandonné : le tracé s'arrête à l'arrêt de déviation,
		// sans le trait droit qui le reliait à l'itinéraire d'origine.
		expect(journey.shape?.getPoints()).toEqual([
			[0, 0],
			[0.01, 0.005],
		]);
		// Les distances restent celles du tracé publié, auxquelles se rapportent arrêts et positions.
		expect(journey.shape?.id).toBe("shape:detour@0-1300");
	});

	it("signale en tracé abandonné la portion que le rognage a ôtée", () => {
		const { trip } = makeShapedGtfs();
		const journey = trip.getScheduledJourney(DATE, true);

		journey.applyModifications(plan, at("08:00").epochMilliseconds);

		const segment = journey.cancelledPath!.segments[0]!;

		// Le ruban court jusqu'à l'ancien terminus, sans être ressoudé à un itinéraire que la course
		// ne retrouve jamais.
		expect(segment.at(-1)).toEqual([0, 0.02]);
	});

	it("laisse le tracé intact quand la course le dessert de bout en bout", () => {
		const { trip } = makeShapedGtfs();
		const journey = trip.getScheduledJourney(DATE, true);

		// Déviation de tracé seul : tous les arrêts sont desservis, il n'y a rien à rogner.
		journey.applyModifications({ ...plan, modifications: [] }, at("08:00").epochMilliseconds);

		expect(journey.shape).toBe(detourShape);
	});
});

describe("Journey#cancelledPath", () => {
	/** Retire l'arrêt B de la course, en empruntant — ou non — un tracé de remplacement. */
	function detourPlan(detourShape?: Shape): TripModificationPlan {
		return {
			modificationsIds: ["detour:1"],
			tripId: "trip",
			date: DATE,
			shape: detourShape,
			revision: "rev:1",
			modifications: [
				{
					startStopSelector: { stopSequence: 2 },
					endStopSelector: { stopSequence: 2 },
					propagatedModificationDelayMs: 0,
					replacementStops: [],
				},
			],
		};
	}

	const detourShape = new Shape("shape:detour", new Float64Array([0, 0, 0, 0.01, 0.01, 1100, 0, 0.02, 2200]));

	it("découpe le tracé théorique entre les arrêts encadrant la déviation", () => {
		const { trip } = makeShapedGtfs();
		const journey = trip.getScheduledJourney(DATE, true);

		journey.applyModifications(detourPlan(detourShape), at("08:00").epochMilliseconds);

		// B est retiré : la portion abandonnée relie A (0 m) à C (2000 m), soit tout le tracé théorique.
		expect(journey.cancelledPath?.segments).toEqual([
			[
				[0, 0],
				[0, 0.01],
				[0, 0.02],
			],
		]);
	});

	it("découpe le tracé théorique même lorsqu'il ne porte aucune distance curviligne", () => {
		const { trip } = makeShapedGtfs({ withShapeDistances: false });
		const journey = trip.getScheduledJourney(DATE, true);

		journey.applyModifications(detourPlan(detourShape), at("08:00").epochMilliseconds);

		expect(journey.cancelledPath?.segments).toEqual([
			[
				[0, 0],
				[0, 0.01],
				[0, 0.02],
			],
		]);
	});

	it("fait partir et finir la portion abandonnée sur le tracé de remplacement", () => {
		const { trip } = makeShapedGtfs();
		const journey = trip.getScheduledJourney(DATE, true);

		// Tracé de remplacement décalé au nord d'une quinzaine de mètres : assez pour que le tracé
		// théorique lui échappe, assez peu pour que la soudure reste un simple comblement de trou.
		const offsetShape = new Shape(
			"shape:offset",
			new Float64Array([0.00015, 0, 0, 0.00015, 0.01, 1100, 0.00015, 0.02, 2200]),
		);
		journey.applyModifications(detourPlan(offsetShape), at("08:00").epochMilliseconds);

		const segment = journey.cancelledPath!.segments[0]!;

		// Les deux bouts du ruban touchent le tracé suivi : plus de trou à la jonction.
		expect(offsetShape.distanceToPosition(segment[0]![0], segment[0]![1])).toBeCloseTo(0, 5);
		expect(offsetShape.distanceToPosition(segment.at(-1)![0], segment.at(-1)![1])).toBeCloseTo(0, 5);
		// Les points du tracé théorique restent entre les deux.
		expect(segment.slice(1, -1)).toEqual([
			[0, 0],
			[0, 0.01],
			[0, 0.02],
		]);
	});

	it("ne soude pas l'extrémité que la course ne rejoint jamais", () => {
		const { trip } = makeShapedGtfs();
		const journey = trip.getScheduledJourney(DATE, true);

		// Tracé de remplacement décalé au nord, et déviation qui retire B et C : elle remplace
		// l'itinéraire jusqu'au terminus, la course ne revient donc jamais sur le tracé d'origine.
		const offsetShape = new Shape(
			"shape:offset",
			new Float64Array([0.00015, 0, 0, 0.00015, 0.01, 1100, 0.00015, 0.02, 2200]),
		);
		journey.applyModifications(
			{
				...detourPlan(offsetShape),
				modifications: [
					{
						startStopSelector: { stopSequence: 2 },
						endStopSelector: { stopSequence: 3 },
						propagatedModificationDelayMs: 0,
						replacementStops: [],
					},
				],
			},
			at("08:00").epochMilliseconds,
		);

		const segment = journey.cancelledPath!.segments[0]!;

		// Le départ de la portion abandonnée est soudé au tracé suivi, là où le véhicule le quitte...
		expect(offsetShape.distanceToPosition(segment[0]![0], segment[0]![1])).toBeCloseTo(0, 5);
		// ...mais son arrivée s'arrête au terminus d'origine, sans trait de retour vers la déviation.
		expect(segment.at(-1)).toEqual([0, 0.02]);
	});

	it("ne soude pas une extrémité trop éloignée du tracé de remplacement", () => {
		const { trip } = makeShapedGtfs();
		const journey = trip.getScheduledJourney(DATE, true);

		// Tracé de remplacement à une centaine de mètres au nord : là où la course le quitte, les deux
		// tracés sont déjà séparés pour de bon. Les raccorder dessinerait un virage que rien ne porte.
		const farShape = new Shape("shape:far", new Float64Array([0.001, 0, 0, 0.001, 0.01, 1100, 0.001, 0.02, 2200]));
		journey.applyModifications(detourPlan(farShape), at("08:00").epochMilliseconds);

		// La portion abandonnée s'en tient aux points du tracé théorique, sans trait vers la déviation.
		expect(journey.cancelledPath?.segments).toEqual([
			[
				[0, 0],
				[0, 0.01],
				[0, 0.02],
			],
		]);
	});

	it("mène la portion abandonnée jusqu'au carrefour quand la déviation passe par la rue voisine", () => {
		const { trip } = makeShapedGtfs();
		const journey = trip.getScheduledJourney(DATE, true);

		// Cas d'Isneauville sur la ligne 20 : la déviation emprunte la rue parallèle, à une vingtaine
		// de mètres au nord, et ne rejoint l'itinéraire qu'au carrefour, au bout du tracé.
		const parallelStreetShape = new Shape(
			"shape:parallel",
			new Float64Array([0.0002, 0, 0, 0.0002, 0.01, 1100, 0, 0.02, 2200]),
		);
		journey.applyModifications(detourPlan(parallelStreetShape), at("08:00").epochMilliseconds);

		// La portion abandonnée va jusqu'au carrefour, sans bifurquer vers la rue voisine en chemin :
		// aucun de ses points ne quitte le tracé théorique, qui est rectiligne.
		const segment = journey.cancelledPath!.segments[0]!;
		expect(segment.every(([latitude]) => latitude === 0)).toBe(true);
		expect(segment.at(-1)).toEqual([0, 0.02]);
	});

	it("n'abandonne aucune portion là où le tracé de remplacement longe celui de la course", () => {
		const { trip } = makeShapedGtfs();
		const journey = trip.getScheduledJourney(DATE, true);

		// Tracé de remplacement confondu avec le tracé théorique, à quelques mètres près.
		const overlappingShape = new Shape(
			"shape:overlapping",
			new Float64Array([0, 0, 0, 0, 0.005, 550, 0, 0.01, 1100, 0, 0.02, 2200]),
		);
		journey.applyModifications(detourPlan(overlappingShape), at("08:00").epochMilliseconds);

		expect(journey.cancelledPath).toBeUndefined();
	});

	it("déduit la portion abandonnée de l'écart des tracés quand la déviation ne retire aucun arrêt", () => {
		const { trip } = makeShapedGtfs();
		const journey = trip.getScheduledJourney(DATE, true);

		// Déviation de tracé seul : toute la desserte est conservée, seul l'itinéraire change.
		journey.applyModifications({ ...detourPlan(detourShape), modifications: [] }, at("08:00").epochMilliseconds);

		expect(journey.calls.map((call) => call.stop.id)).toEqual(["A", "B", "C"]);
		// Le point médian du tracé théorique est le seul que la déviation contourne.
		expect(journey.cancelledPath?.segments).toEqual([
			[
				[0, 0],
				[0, 0.01],
				[0, 0.02],
			],
		]);
	});

	it("renonce au diff des tracés lorsqu'ils ne décrivent pas le même trajet", () => {
		const { trip } = makeShapedGtfs();
		const journey = trip.getScheduledJourney(DATE, true);

		// Tracé de remplacement à des kilomètres du tracé théorique : tous ses points s'en écartent,
		// signaler la course entière comme abandonnée n'aurait aucun sens.
		const unrelatedShape = new Shape("shape:unrelated", new Float64Array([1, 1, 0, 1, 1.01, 1100]));
		journey.applyModifications({ ...detourPlan(unrelatedShape), modifications: [] }, at("08:00").epochMilliseconds);

		expect(journey.cancelledPath).toBeUndefined();
	});

	it("n'abandonne aucune portion quand la déviation ne fournit pas son propre tracé", () => {
		const { trip } = makeShapedGtfs();
		const journey = trip.getScheduledJourney(DATE, true);

		journey.applyModifications(detourPlan(), at("08:00").epochMilliseconds);

		expect(journey.cancelledPath).toBeUndefined();
	});

	it("oublie le tracé abandonné dès que la déviation est levée", () => {
		const { trip } = makeShapedGtfs();
		const journey = trip.getScheduledJourney(DATE, true);

		journey.applyModifications(detourPlan(detourShape), at("08:00").epochMilliseconds);
		expect(journey.cancelledPath).toBeDefined();

		journey.clearModifications();
		expect(journey.cancelledPath).toBeUndefined();
	});
});

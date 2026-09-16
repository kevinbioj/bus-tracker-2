import { describe, expect, it } from "vitest";
import type { JourneyCall } from "./journey.js";
import { Shape } from "./shape.js";
import { Stop } from "./stop.js";
import {
	buildModifiedCalls,
	computeCancelledCallRanges,
	type ResolvedModification,
	type TripModificationPlan,
} from "./trip-modification.js";

const DATE = Temporal.PlainDate.from("2026-05-18");

const STOPS = {
	A: new Stop("A", "A", 0, 0),
	B: new Stop("B", "B", 0, 0.01),
	C: new Stop("C", "C", 0, 0.02),
	D: new Stop("D", "D", 0, 0.03),
	X: new Stop("X", "Déviation", 0.01, 0.01),
	Y: new Stop("Y", "Déviation 2", 0.01, 0.03),
};

function at(minutes: number) {
	return Temporal.Instant.from(`2026-05-18T08:00:00Z`).epochMilliseconds + minutes * 60_000;
}

/** Course théorique A 8:00 → B 8:10 → C 8:20 → D 8:30, distances tous les 1000 m. */
function scheduledCalls(): JourneyCall[] {
	return [STOPS.A, STOPS.B, STOPS.C, STOPS.D].map((stop, index) => ({
		aimedArrivalTime: at(index * 10),
		aimedDepartureTime: at(index * 10),
		stop,
		sequence: index + 1,
		distanceTraveled: index * 1000,
		status: "SCHEDULED" as const,
		flags: [],
	}));
}

function makePlan(modifications: Partial<ResolvedModification>[], shape?: Shape): TripModificationPlan {
	return {
		modificationsId: "detour:1",
		tripId: "original",
		date: DATE,
		shape,
		revision: "rev:1",
		modifications: modifications.map((modification) => ({
			propagatedModificationDelayMs: 0,
			replacementStops: [],
			...modification,
		})),
	};
}

/** Lecture compacte du résultat : arrêt, statut et minute d'arrivée. */
function summarize(calls: JourneyCall[] | undefined) {
	return calls?.map((call) => ({
		stop: call.stop.id,
		status: call.status,
		sequence: call.sequence,
		minutes: (call.aimedArrivalTime - at(0)) / 60_000,
	}));
}

describe("buildModifiedCalls", () => {
	it("remplace un arrêt par un arrêt de déviation", () => {
		const calls = buildModifiedCalls(
			scheduledCalls(),
			makePlan([
				{
					startStopSelector: { stopSequence: 2 },
					endStopSelector: { stopSequence: 2 },
					replacementStops: [{ stop: STOPS.X, travelTimeToStopMs: 8 * 60_000 }],
				},
			]),
		);

		expect(summarize(calls)).toEqual([
			{ stop: "A", status: "SCHEDULED", sequence: 1, minutes: 0 },
			{ stop: "B", status: "SKIPPED", sequence: 2, minutes: 10 },
			{ stop: "X", status: "UNSCHEDULED", sequence: 3, minutes: 8 },
			{ stop: "C", status: "SCHEDULED", sequence: 4, minutes: 20 },
			{ stop: "D", status: "SCHEDULED", sequence: 5, minutes: 30 },
		]);
	});

	it("marque l'origine des arrêts de la déviation", () => {
		const calls = buildModifiedCalls(
			scheduledCalls(),
			makePlan([
				{
					startStopSelector: { stopSequence: 2 },
					endStopSelector: { stopSequence: 2 },
					replacementStops: [{ stop: STOPS.X, travelTimeToStopMs: 8 * 60_000 }],
				},
			]),
		)!;

		expect(calls.map((call) => call.modification)).toEqual([undefined, "REMOVED", "ADDED", undefined, undefined]);
	});

	it("insère des arrêts sans en retirer quand aucun arrêt de fin n'est désigné", () => {
		const calls = buildModifiedCalls(
			scheduledCalls(),
			makePlan([
				{
					startStopSelector: { stopSequence: 3 },
					replacementStops: [{ stop: STOPS.X, travelTimeToStopMs: 15 * 60_000 }],
				},
			]),
		);

		// L'arrêt de référence est celui qui précède le sélecteur de début, soit B à 8:10.
		expect(summarize(calls)).toEqual([
			{ stop: "A", status: "SCHEDULED", sequence: 1, minutes: 0 },
			{ stop: "B", status: "SCHEDULED", sequence: 2, minutes: 10 },
			{ stop: "X", status: "UNSCHEDULED", sequence: 3, minutes: 25 },
			{ stop: "C", status: "SCHEDULED", sequence: 4, minutes: 20 },
			{ stop: "D", status: "SCHEDULED", sequence: 5, minutes: 30 },
		]);
	});

	it("retire une plage d'arrêts sans remplacement", () => {
		const calls = buildModifiedCalls(
			scheduledCalls(),
			makePlan([{ startStopSelector: { stopSequence: 2 }, endStopSelector: { stopSequence: 3 } }]),
		);

		expect(summarize(calls)).toEqual([
			{ stop: "A", status: "SCHEDULED", sequence: 1, minutes: 0 },
			{ stop: "B", status: "SKIPPED", sequence: 2, minutes: 10 },
			{ stop: "C", status: "SKIPPED", sequence: 3, minutes: 20 },
			{ stop: "D", status: "SCHEDULED", sequence: 4, minutes: 30 },
		]);
	});

	it("prend le premier arrêt pour référence quand c'est lui que la déviation affecte", () => {
		const calls = buildModifiedCalls(
			scheduledCalls(),
			makePlan([
				{
					startStopSelector: { stopSequence: 1 },
					endStopSelector: { stopSequence: 1 },
					replacementStops: [{ stop: STOPS.X, travelTimeToStopMs: 2 * 60_000 }],
				},
			]),
		);

		expect(summarize(calls)?.slice(0, 2)).toEqual([
			{ stop: "A", status: "SKIPPED", sequence: 1, minutes: 0 },
			{ stop: "X", status: "UNSCHEDULED", sequence: 2, minutes: 2 },
		]);
	});

	it("propage le retard aux arrêts suivant la déviation", () => {
		const calls = buildModifiedCalls(
			scheduledCalls(),
			makePlan([
				{
					startStopSelector: { stopSequence: 2 },
					endStopSelector: { stopSequence: 2 },
					replacementStops: [{ stop: STOPS.X, travelTimeToStopMs: 8 * 60_000 }],
					propagatedModificationDelayMs: 3 * 60_000,
				},
			]),
		);

		expect(summarize(calls)?.slice(3)).toEqual([
			{ stop: "C", status: "SCHEDULED", sequence: 4, minutes: 23 },
			{ stop: "D", status: "SCHEDULED", sequence: 5, minutes: 33 },
		]);
	});

	it("cumule les retards de déviations successives", () => {
		const calls = buildModifiedCalls(
			scheduledCalls(),
			makePlan([
				{
					startStopSelector: { stopSequence: 2 },
					endStopSelector: { stopSequence: 2 },
					replacementStops: [{ stop: STOPS.X, travelTimeToStopMs: 8 * 60_000 }],
					propagatedModificationDelayMs: 3 * 60_000,
				},
				{
					startStopSelector: { stopSequence: 4 },
					replacementStops: [{ stop: STOPS.Y, travelTimeToStopMs: 5 * 60_000 }],
					propagatedModificationDelayMs: 2 * 60_000,
				},
			]),
		);

		// C est décalé de 3 min ; Y part de C décalé (8:23) ; D cumule les deux retards.
		expect(summarize(calls)?.slice(3)).toEqual([
			{ stop: "C", status: "SCHEDULED", sequence: 4, minutes: 23 },
			{ stop: "Y", status: "UNSCHEDULED", sequence: 5, minutes: 28 },
			{ stop: "D", status: "SCHEDULED", sequence: 6, minutes: 35 },
		]);
	});

	it("accepte des sélecteurs exprimés par identifiant d'arrêt", () => {
		const calls = buildModifiedCalls(
			scheduledCalls(),
			makePlan([
				{
					startStopSelector: { stopId: "B" },
					endStopSelector: { stopId: "C" },
					replacementStops: [{ stop: STOPS.X, travelTimeToStopMs: 60_000 }],
				},
			]),
		);

		expect(summarize(calls)?.map(({ stop, status }) => `${stop}:${status}`)).toEqual([
			"A:SCHEDULED",
			"B:SKIPPED",
			"C:SKIPPED",
			"X:UNSCHEDULED",
			"D:SCHEDULED",
		]);
	});

	it("renonce à la déviation quand un sélecteur ne désigne aucun arrêt", () => {
		expect(
			buildModifiedCalls(scheduledCalls(), makePlan([{ startStopSelector: { stopSequence: 42 } }])),
		).toBeUndefined();
		expect(
			buildModifiedCalls(
				scheduledCalls(),
				makePlan([{ startStopSelector: { stopSequence: 2 }, endStopSelector: { stopId: "inconnu" } }]),
			),
		).toBeUndefined();
		expect(buildModifiedCalls(scheduledCalls(), makePlan([{}]))).toBeUndefined();
	});

	it("renonce à la déviation qui ne laisserait aucun arrêt desservi", () => {
		expect(
			buildModifiedCalls(
				scheduledCalls(),
				makePlan([{ startStopSelector: { stopSequence: 1 }, endStopSelector: { stopSequence: 4 } }]),
			),
		).toBeUndefined();
	});

	it("reprojette les distances des arrêts desservis sur le tracé de la déviation", () => {
		const shape = new Shape("shape:detour", new Float64Array([0, 0, 0, 0.01, 0.01, 500, 0, 0.02, 1500, 0, 0.03, 2500]));

		const calls = buildModifiedCalls(
			scheduledCalls(),
			makePlan(
				[
					{
						startStopSelector: { stopSequence: 2 },
						endStopSelector: { stopSequence: 2 },
						replacementStops: [{ stop: STOPS.X, travelTimeToStopMs: 8 * 60_000 }],
					},
				],
				shape,
			),
		)!;

		expect(calls.map((call) => call.distanceTraveled)).toEqual([0, 1000, 500, 1500, 2500]);
	});

	it("laisse la course intacte quand elle n'a aucun arrêt", () => {
		expect(buildModifiedCalls([], makePlan([{ startStopSelector: { stopSequence: 1 } }]))).toBeUndefined();
	});
});

describe("computeCancelledCallRanges", () => {
	it("borne la portion abandonnée aux arrêts desservis qui encadrent la déviation", () => {
		const ranges = computeCancelledCallRanges(
			scheduledCalls(),
			makePlan([{ startStopSelector: { stopSequence: 2 }, endStopSelector: { stopSequence: 3 } }]),
		);

		// B et C sont retirés : le véhicule quitte l'itinéraire à A (indice 0) et le retrouve à D (3).
		expect(ranges).toEqual([[0, 3]]);
	});

	it("prend l'arrêt retiré pour borne quand la déviation atteint une extrémité de la course", () => {
		expect(
			computeCancelledCallRanges(
				scheduledCalls(),
				makePlan([{ startStopSelector: { stopSequence: 1 }, endStopSelector: { stopSequence: 2 } }]),
			),
		).toEqual([[0, 2]]);

		expect(
			computeCancelledCallRanges(
				scheduledCalls(),
				makePlan([{ startStopSelector: { stopSequence: 3 }, endStopSelector: { stopSequence: 4 } }]),
			),
		).toEqual([[1, 3]]);
	});

	it("retourne une plage par modification", () => {
		const ranges = computeCancelledCallRanges(
			scheduledCalls(),
			makePlan([
				{ startStopSelector: { stopSequence: 2 }, endStopSelector: { stopSequence: 2 } },
				{ startStopSelector: { stopSequence: 4 }, endStopSelector: { stopSequence: 4 } },
			]),
		);

		expect(ranges).toEqual([
			[0, 2],
			[2, 3],
		]);
	});

	it("n'abandonne aucune portion lorsque la déviation n'insère que des arrêts", () => {
		expect(
			computeCancelledCallRanges(scheduledCalls(), makePlan([{ startStopSelector: { stopSequence: 2 } }])),
		).toEqual([]);
	});

	it("n'abandonne aucune portion lorsqu'un sélecteur ne désigne aucun arrêt", () => {
		expect(
			computeCancelledCallRanges(
				scheduledCalls(),
				makePlan([{ startStopSelector: { stopSequence: 2 }, endStopSelector: { stopSequence: 99 } }]),
			),
		).toEqual([]);
	});
});

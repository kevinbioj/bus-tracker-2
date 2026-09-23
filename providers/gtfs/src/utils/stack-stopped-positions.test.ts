import type { VehicleJourney } from "@bus-tracker/contracts";
import { describe, expect, it } from "vitest";

import { Shape } from "../model/shape.js";
import { getDistance } from "./get-distance.js";
import { stackStoppedPositions } from "./stack-stopped-positions.js";

/** Tracé rectiligne vers l'est le long de l'équateur, avec distances curvilignes réelles (0,01° ≈ 1 112 m). */
const shape = new Shape("shape", new Float64Array([0, 0, 0, 0, 0.01, 1111.95, 0, 0.02, 2223.9]));

/** Longitude d'un point de {@link shape} donné par sa distance curviligne. */
const longitudeAt = (distanceTraveled: number) => shape.interpolateAt(distanceTraveled)!.longitude;

const createJourney = (
	id: string,
	distanceTraveled: number,
	arrivedAt: string,
	overrides: Partial<NonNullable<VehicleJourney["position"]>> = {},
): VehicleJourney =>
	({
		id,
		networkRef: "TEST",
		position: {
			latitude: 0,
			longitude: longitudeAt(distanceTraveled),
			bearing: 90,
			atStop: true,
			type: "COMPUTED",
			distanceTraveled,
			recordedAt: arrivedAt,
			...overrides,
		},
		updatedAt: "2026-09-23T12:00:00Z",
	}) as VehicleJourney;

const stack = (journeys: VehicleJourney[]) => stackStoppedPositions(journeys, () => shape);

describe("stackStoppedPositions", () => {
	it("laisse seul à l'arrêt un véhicule isolé", () => {
		const journeys = [createJourney("a", 1000, "2026-09-23T12:00:00+02:00")];

		expect(stack(journeys)).toBe(0);
		expect(journeys[0]!.position).toMatchObject({ longitude: longitudeAt(1000), distanceTraveled: 1000 });
	});

	it("met en file sur le tracé, par ordre d'arrivée, les véhicules arrêtés au même point", () => {
		const journeys = [
			createJourney("c", 1000, "2026-09-23T12:02:00+02:00"),
			createJourney("a", 1000, "2026-09-23T12:00:00+02:00"),
			createJourney("b", 1000, "2026-09-23T12:01:00+02:00"),
		];

		expect(stack(journeys)).toBe(2);

		const [c, a, b] = journeys.map((journey) => journey.position!);
		expect(a).toMatchObject({ distanceTraveled: 1000, longitude: longitudeAt(1000) });
		expect(b).toMatchObject({ distanceTraveled: 997, latitude: 0, bearing: 90 });
		expect(c).toMatchObject({ distanceTraveled: 994, latitude: 0, bearing: 90 });
		expect(getDistance(a!.latitude, a!.longitude, b!.latitude, b!.longitude)).toBeCloseTo(3, 1);
		expect(getDistance(b!.latitude, b!.longitude, c!.latitude, c!.longitude)).toBeCloseTo(3, 1);
	});

	it("départage les arrivées simultanées par identifiant, quel que soit l'ordre du flux", () => {
		const forward = [
			createJourney("a", 1000, "2026-09-23T12:00:00+02:00"),
			createJourney("b", 1000, "2026-09-23T12:00:00+02:00"),
		];
		const backward = [
			createJourney("b", 1000, "2026-09-23T12:00:00+02:00"),
			createJourney("a", 1000, "2026-09-23T12:00:00+02:00"),
		];
		stack(forward);
		stack(backward);

		expect(forward[1]!.position).toEqual(backward[0]!.position);
		expect(forward[0]!.position!.distanceTraveled).toBe(1000);
	});

	it("prolonge le début du tracé pour les véhicules en attente au départ", () => {
		const journeys = [
			createJourney("a", 0, "2026-09-23T12:00:00+02:00"),
			createJourney("b", 0, "2026-09-23T12:10:00+02:00"),
		];
		stack(journeys);

		const position = journeys[1]!.position!;
		expect(position.distanceTraveled).toBe(-3);
		expect(position.latitude).toBeCloseTo(0, 9);
		expect(position.longitude).toBeLessThan(0);
		expect(getDistance(0, 0, position.latitude, position.longitude)).toBeCloseTo(3, 1);
	});

	it("ignore les véhicules en mouvement, les positions GPS et les courses sans tracé", () => {
		const journeys = [
			createJourney("a", 1000, "2026-09-23T12:00:00+02:00"),
			createJourney("b", 1000, "2026-09-23T12:01:00+02:00", { atStop: false }),
			createJourney("c", 1000, "2026-09-23T12:01:00+02:00", { type: "GPS" }),
			createJourney("d", 1000, "2026-09-23T12:01:00+02:00"),
		];

		expect(stackStoppedPositions(journeys, (journey) => (journey.id === "d" ? undefined : shape))).toBe(0);
	});

	it("ne met pas en file deux véhicules arrêtés à des points distincts", () => {
		const journeys = [
			createJourney("a", 1000, "2026-09-23T12:00:00+02:00"),
			createJourney("b", 1020, "2026-09-23T12:01:00+02:00"),
		];

		expect(stack(journeys)).toBe(0);
	});
});

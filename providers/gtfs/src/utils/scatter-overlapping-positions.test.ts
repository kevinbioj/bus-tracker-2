import type { VehicleJourney } from "@bus-tracker/contracts";
import { describe, expect, it } from "vitest";
import { getDistance } from "./get-distance.js";
import { scatterOverlappingPositions } from "./scatter-overlapping-positions.js";

const createJourney = (
	id: string,
	latitude: number,
	longitude: number,
	type: "GPS" | "COMPUTED" = "GPS",
): VehicleJourney =>
	({
		id,
		networkRef: "TEST",
		position: {
			latitude,
			longitude,
			atStop: false,
			type,
			recordedAt: "2026-08-04T12:00:00+02:00",
		},
		updatedAt: "2026-08-04T12:00:00Z",
	}) as VehicleJourney;

describe("scatterOverlappingPositions", () => {
	it("leaves distinct positions untouched", () => {
		const journeys = [createJourney("a", 48.8566, 2.3522), createJourney("b", 48.857, 2.3532)];

		expect(scatterOverlappingPositions(journeys)).toBe(0);
		expect(journeys[0]!.position).toMatchObject({ latitude: 48.8566, longitude: 2.3522 });
		expect(journeys[1]!.position).toMatchObject({ latitude: 48.857, longitude: 2.3532 });
	});

	it("separates strictly overlapping vehicles", () => {
		const journeys = [createJourney("a", 48.8566, 2.3522), createJourney("b", 48.8566, 2.3522)];

		expect(scatterOverlappingPositions(journeys)).toBe(2);

		const [first, second] = journeys as [VehicleJourney, VehicleJourney];
		const distance = getDistance(
			first.position!.latitude,
			first.position!.longitude,
			second.position!.latitude,
			second.position!.longitude,
		);
		expect(distance).toBeGreaterThan(4);
		expect(distance).toBeLessThan(15);
	});

	it("keeps scattered vehicles close to their original point", () => {
		const journeys = [createJourney("a", 48.8566, 2.3522), createJourney("b", 48.8566, 2.3522)];
		scatterOverlappingPositions(journeys);

		for (const journey of journeys) {
			expect(getDistance(48.8566, 2.3522, journey.position!.latitude, journey.position!.longitude)).toBeLessThan(10);
		}
	});

	it("is deterministic across cycles", () => {
		const first = [createJourney("a", 48.8566, 2.3522), createJourney("b", 48.8566, 2.3522)];
		// Ordre inversé : le tri interne par identifiant doit produire le même résultat.
		const second = [createJourney("b", 48.8566, 2.3522), createJourney("a", 48.8566, 2.3522)];

		scatterOverlappingPositions(first);
		scatterOverlappingPositions(second);

		expect(first[0]!.position).toStrictEqual(second[1]!.position);
		expect(first[1]!.position).toStrictEqual(second[0]!.position);
	});

	it("does not move existing vehicles when one joins the cluster", () => {
		const before = ["a", "b"].map((id) => createJourney(id, 48.8566, 2.3522));
		const after = ["a", "b", "c"].map((id) => createJourney(id, 48.8566, 2.3522));

		scatterOverlappingPositions(before);
		scatterOverlappingPositions(after);

		expect(after[0]!.position).toStrictEqual(before[0]!.position);
		expect(after[1]!.position).toStrictEqual(before[1]!.position);
	});

	it("does not move remaining vehicles when one leaves the cluster", () => {
		const before = ["a", "b", "c"].map((id) => createJourney(id, 48.8566, 2.3522));
		const after = ["a", "c"].map((id) => createJourney(id, 48.8566, 2.3522));

		scatterOverlappingPositions(before);
		scatterOverlappingPositions(after);

		expect(after[0]!.position).toStrictEqual(before[0]!.position);
		expect(after[1]!.position).toStrictEqual(before[2]!.position);
	});

	it("keeps a vehicle in place when the cluster moves along the route", () => {
		// Les positions brutes avancent de quelques mètres entre deux cycles : le décalage appliqué
		// doit être le même, donc les positions bruitées avancent d'autant.
		const first = ["a", "b"].map((id) => createJourney(id, 48.8566, 2.3522));
		const second = ["a", "b"].map((id) => createJourney(id, 48.8566, 2.3522));

		scatterOverlappingPositions(first);
		scatterOverlappingPositions(second);

		expect(second[0]!.position).toStrictEqual(first[0]!.position);
		expect(second[1]!.position).toStrictEqual(first[1]!.position);
	});

	it("scatters a whole cluster of more than two vehicles", () => {
		const journeys = ["a", "b", "c"].map((id) => createJourney(id, 45.764, 4.8357));

		expect(scatterOverlappingPositions(journeys)).toBe(3);

		for (let i = 0; i < journeys.length; i++) {
			for (let j = i + 1; j < journeys.length; j++) {
				const distance = getDistance(
					journeys[i]!.position!.latitude,
					journeys[i]!.position!.longitude,
					journeys[j]!.position!.latitude,
					journeys[j]!.position!.longitude,
				);
				expect(distance).toBeGreaterThan(4);
			}
		}
	});

	it("keeps every vehicle apart even beyond one full ring", () => {
		// 12 véhicules pour 8 secteurs : le sondage sature l'anneau intérieur puis déborde sur le
		// suivant. Aucun ne doit se retrouver sur un autre, malgré les collisions de secteur.
		const journeys = Array.from({ length: 12 }, (_, index) => createJourney(`vehicle-${index}`, 45.764, 4.8357));

		expect(scatterOverlappingPositions(journeys)).toBe(12);

		for (let i = 0; i < journeys.length; i++) {
			for (let j = i + 1; j < journeys.length; j++) {
				const distance = getDistance(
					journeys[i]!.position!.latitude,
					journeys[i]!.position!.longitude,
					journeys[j]!.position!.latitude,
					journeys[j]!.position!.longitude,
				);
				expect(distance).toBeGreaterThan(4);
			}
		}
	});

	it("ignores computed positions", () => {
		const journeys = [createJourney("a", 48.8566, 2.3522, "COMPUTED"), createJourney("b", 48.8566, 2.3522, "COMPUTED")];

		expect(scatterOverlappingPositions(journeys)).toBe(0);
		expect(journeys[0]!.position).toMatchObject({ latitude: 48.8566, longitude: 2.3522 });
	});

	it("does not move a vehicle away from a nearby but distinct one", () => {
		// ~11 m d'écart : deux bus qui se suivent, pas une superposition.
		const journeys = [createJourney("a", 48.8566, 2.3522), createJourney("b", 48.8567, 2.3522)];

		expect(scatterOverlappingPositions(journeys)).toBe(0);
	});
});

import { describe, expect, it } from "vitest";

import { restoreShapePrecision } from "./restore-shape-precision.js";
import { Shape } from "./shape.js";

function createShape(id: string, points: [number, number][], approximateCoordinates = false) {
	const typedPoints = new Float64Array(points.length * 3);
	for (let i = 0; i < points.length; i++) {
		typedPoints[i * 3] = points[i]![0];
		typedPoints[i * 3 + 1] = points[i]![1];
		typedPoints[i * 3 + 2] = i;
	}
	return new Shape(id, typedPoints, true, approximateCoordinates);
}

const round5 = ([latitude, longitude]: [number, number]): [number, number] => [
	Math.round(latitude * 1e5) / 1e5,
	Math.round(longitude * 1e5) / 1e5,
];

/** Rue légèrement courbe, un sommet tous les ~4 m, à 7 décimales. */
const street: [number, number][] = Array.from({ length: 40 }, (_, i) => [
	49.4619 + i * 0.0000123 + Math.sin(i / 5) * 0.0000071,
	1.0711 - i * 0.0000517,
]);

describe("restoreShapePrecision", () => {
	it("reprend les sommets du tracé de référence là où le tracé arrondi le suit", () => {
		const reference = createShape("reference", street);
		const degraded = createShape("detour", street.map(round5), true);

		const restored = restoreShapePrecision(degraded, reference);

		expect(restored.getPoints()).toEqual(street);
		expect(restored.id).toBe("detour~reference");
		expect(restored.approximateCoordinates).toBe(false);
	});

	it("garde les points publiés là où le tracé s'écarte de la référence", () => {
		const reference = createShape("reference", street);
		// Déviation par une rue parallèle, ~50 m plus au nord, entre les sommets 10 et 30.
		const detour = (
			[...street.slice(0, 11), [49.4625, 1.07055], [49.4625, 1.07005], ...street.slice(30)] as [number, number][]
		).map(round5);
		const degraded = createShape("detour", detour, true);

		const points = restoreShapePrecision(degraded, reference).getPoints();

		expect(points.slice(0, 11)).toEqual(street.slice(0, 11));
		expect(points.slice(11, 13)).toEqual([
			[49.4625, 1.07055],
			[49.4625, 1.07005],
		]);
		expect(points.slice(13)).toEqual(street.slice(30));
	});

	it("reprend les sommets de référence situés entre deux points publiés espacés", () => {
		const reference = createShape("reference", street);
		// Le producteur n'a gardé qu'un point sur dix.
		const degraded = createShape(
			"detour",
			street.filter((_, i) => i % 10 === 0 || i === street.length - 1).map(round5),
			true,
		);

		expect(restoreShapePrecision(degraded, reference).getPoints()).toEqual(street);
	});

	it("ne saute pas d'un passage à l'autre d'une référence qui repasse au même endroit", () => {
		// Aller puis retour sur la même rue.
		const reference = createShape("reference", [...street, ...street.toReversed().slice(1)]);
		const degraded = createShape("detour", [...street, ...street.toReversed().slice(1)].map(round5), true);

		expect(restoreShapePrecision(degraded, reference).getPoints()).toEqual([
			...street,
			...street.toReversed().slice(1),
		]);
	});

	it("rend le tracé tel quel s'il ne suit jamais la référence", () => {
		const reference = createShape("reference", street);
		const degraded = createShape(
			"detour",
			[
				[49.47, 1.08],
				[49.471, 1.081],
			],
			true,
		);

		expect(restoreShapePrecision(degraded, reference)).toBe(degraded);
	});
});

import { describe, expect, it } from "vitest";

import { createShapeFromPolyline, decodePolyline } from "./decode-polyline.js";

/** Exemple de référence de l'algorithme Google : (38.5, -120.2), (40.7, -120.95), (43.252, -126.453). */
const REFERENCE_POLYLINE = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";

describe("decodePolyline", () => {
	it("décode la polyligne de référence", () => {
		expect(decodePolyline(REFERENCE_POLYLINE)).toEqual([
			[38.5, -120.2],
			[40.7, -120.95],
			[43.252, -126.453],
		]);
	});

	it("décode une polyligne à un seul point", () => {
		expect(decodePolyline("_p~iF~ps|U")).toEqual([[38.5, -120.2]]);
	});

	it("renvoie un tableau vide sur une chaîne vide", () => {
		expect(decodePolyline("")).toEqual([]);
	});

	it("renvoie un tableau vide sur une chaîne tronquée", () => {
		// Latitude complète, longitude coupée en plein milieu de son groupe de bits.
		expect(decodePolyline("_p~iF~ps")).toEqual([]);
	});
});

describe("createShapeFromPolyline", () => {
	it("construit un tracé dont les distances cumulées croissent", () => {
		const shape = createShapeFromPolyline("shape:rt", REFERENCE_POLYLINE);

		expect(shape).toBeDefined();
		expect(shape!.id).toBe("shape:rt");
		expect(shape!.length).toBe(3);
		expect(shape!.getPoint(0)).toEqual([38.5, -120.2]);
		expect(shape!.getPointDistanceTraveled(0)).toBe(0);
		expect(shape!.getPointDistanceTraveled(1)!).toBeGreaterThan(0);
		expect(shape!.getPointDistanceTraveled(2)!).toBeGreaterThan(shape!.getPointDistanceTraveled(1)!);
	});

	it("marque le tracé comme ayant des distances recalculées", () => {
		expect(createShapeFromPolyline("shape:rt", REFERENCE_POLYLINE)!.recalculatedDistances).toBe(true);
	});

	it("interpole une position sur le tracé décodé", () => {
		const shape = createShapeFromPolyline("shape:rt", REFERENCE_POLYLINE)!;
		const total = shape.getPointDistanceTraveled(2)!;

		const point = shape.interpolateAt(total / 2);

		expect(point).toBeDefined();
		expect(point!.latitude).toBeGreaterThan(38.5);
		expect(point!.latitude).toBeLessThan(43.252);
	});

	it("rejette une polyligne de moins de deux points", () => {
		expect(createShapeFromPolyline("shape:rt", "_p~iF~ps|U")).toBeUndefined();
		expect(createShapeFromPolyline("shape:rt", "")).toBeUndefined();
	});
});

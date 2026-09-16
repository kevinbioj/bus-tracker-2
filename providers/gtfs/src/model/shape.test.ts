import { describe, expect, it } from "vitest";

import { Shape } from "./shape.js";

/** Tracé rectiligne le long de l'équateur, jalonné tous les 0,01° — sans distances curvilignes. */
const shape = new Shape(
	"shape",
	new Float64Array([
		0,
		0,
		Number.NaN,
		0,
		0.01,
		Number.NaN,
		0,
		0.02,
		Number.NaN,
		0,
		0.03,
		Number.NaN,
		0,
		0.04,
		Number.NaN,
	]),
);

describe("Shape#sliceBetweenPositions", () => {
	it("découpe entre les points les plus proches des deux positions, distances curvilignes ou non", () => {
		// Les positions données tombent à côté du tracé : chacune est ramenée au point le plus proche.
		expect(
			shape.sliceBetweenPositions({ latitude: 0.001, longitude: 0.009 }, { latitude: -0.001, longitude: 0.031 }),
		).toEqual([
			[0, 0.01],
			[0, 0.02],
			[0, 0.03],
		]);
	});

	it("inclut les deux extrémités du tracé lorsqu'elles sont désignées", () => {
		expect(shape.sliceBetweenPositions({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0.04 })).toHaveLength(
			5,
		);
	});

	it("refuse une plage vide ou remontant le tracé", () => {
		expect(shape.sliceBetweenPositions({ latitude: 0, longitude: 0.02 }, { latitude: 0, longitude: 0.02 })).toEqual([]);
		expect(shape.sliceBetweenPositions({ latitude: 0, longitude: 0.03 }, { latitude: 0, longitude: 0.01 })).toEqual([]);
	});
});

describe("Shape#projectPosition", () => {
	it("projette sur le segment le plus proche, entre deux sommets", () => {
		const projection = shape.projectPosition(0.001, 0.005);

		expect(projection?.latitude).toBeCloseTo(0, 5);
		expect(projection?.longitude).toBeCloseTo(0.005, 5);
		expect(projection?.distance).toBeCloseTo(111, 0);
	});

	it("ne projette rien hors d'un tracé vide", () => {
		expect(new Shape("shape:empty", new Float64Array([])).projectPosition(0, 0)).toBeUndefined();
	});
});

describe("Shape#distanceToPosition", () => {
	it("mesure jusqu'à la projection sur le segment, non jusqu'au sommet le plus proche", () => {
		// Position au milieu du premier segment, décalée de ~111 m au nord : les deux sommets qui
		// l'encadrent sont bien plus loin qu'elle ne l'est du segment lui-même.
		expect(shape.distanceToPosition(0.001, 0.005)).toBeCloseTo(111, 0);
	});

	it("renvoie une distance nulle pour une position posée sur le tracé", () => {
		expect(shape.distanceToPosition(0, 0.02)).toBeCloseTo(0, 5);
	});
});

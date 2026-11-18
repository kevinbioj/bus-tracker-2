import { describe, expect, it } from "vitest";

import { Stop } from "./stop.js";
import { assignTripPatterns, MAX_PATTERN_CANDIDATES, StopTimeStore } from "./stop-time-store.js";

const A = new Stop("a", "A", 0, 0);
const B = new Stop("b", "B", 0, 0.01);
const C = new Stop("c", "C", 0, 0.02);

type TripInput = {
	stops: Stop[];
	sequences: number[];
	flags?: number[];
	distances?: number[];
	headsigns?: (string | undefined)[];
	departures: number[];
};

function buildStore(trips: TripInput[]) {
	const stopList = [A, B, C];
	const headsignList = [""];
	const tripStart: number[] = [];
	let cursor = 0;
	for (const trip of trips) {
		tripStart.push(cursor);
		cursor += trip.stops.length;
	}
	const departures = Uint32Array.from(trips.flatMap((trip) => trip.departures));
	const withHeadsigns = trips.some((trip) => trip.headsigns !== undefined);
	const headsignIndexOf = (headsign: string | undefined) => {
		if (headsign === undefined) return 0;
		if (!headsignList.includes(headsign)) headsignList.push(headsign);
		return headsignList.indexOf(headsign);
	};
	return new StopTimeStore(
		stopList,
		Uint32Array.from(trips.flatMap((trip) => trip.stops.map((stop) => stopList.indexOf(stop)))),
		Uint8Array.from(trips.flatMap((trip) => trip.sequences)),
		Uint8Array.from(trips.flatMap((trip) => trip.flags ?? trip.stops.map(() => 0))),
		departures,
		departures,
		Float32Array.from(trips.flatMap((trip) => trip.distances ?? trip.stops.map(() => Number.NaN))),
		Uint32Array.from(tripStart),
		Uint32Array.from(trips, (trip) => trip.stops.length),
		Uint32Array.from(trips, (trip) => trip.departures[0] ?? 0),
		Uint32Array.from(trips, (trip) => trip.departures.at(-1) ?? 0),
		Uint32Array.from(trips, (trip) => trip.departures.at(-1) ?? 0),
		headsignList,
		withHeadsigns
			? Uint32Array.from(trips.flatMap((trip) => trip.stops.map((_, i) => headsignIndexOf(trip.headsigns?.[i]))))
			: undefined,
	);
}

describe("StopTimeStore (schémas de desserte)", () => {
	it("partage un parcours entre deux courses, chacune gardant ses heures", () => {
		const store = buildStore([
			{ stops: [A, B, C], sequences: [1, 2, 3], distances: [0, 1000, 2000], departures: [100, 200, 300] },
			{ stops: [A, B, C], sequences: [1, 2, 3], distances: [0, 1000, 2000], departures: [400, 500, 600] },
		]);

		expect(store.patternStart).toHaveLength(1);
		expect(store.tripPattern[0]).toBe(store.tripPattern[1]);
		expect(Array.from(store.departureSecs)).toEqual([100, 200, 300, 400, 500, 600]);
		expect([3, 4, 5].map((index) => store.getStop(index).id)).toEqual(["a", "b", "c"]);
	});

	it("distingue deux courses qui ne diffèrent que par une distance, un flag ou une girouette", () => {
		const base: TripInput = { stops: [A, B], sequences: [1, 2], distances: [0, 1000], departures: [100, 200] };

		expect(buildStore([base, { ...base, distances: [0, 1001] }]).patternStart).toHaveLength(2);
		expect(buildStore([base, { ...base, flags: [0, 2] }]).patternStart).toHaveLength(2);
		expect(buildStore([base, { ...base, headsigns: [undefined, "Vers B"] }]).patternStart).toHaveLength(2);
	});

	it("tient les distances inconnues pour égales entre elles", () => {
		const store = buildStore([
			{ stops: [A, B], sequences: [1, 2], departures: [100, 200] },
			{ stops: [A, B], sequences: [1, 2], departures: [300, 400] },
		]);

		expect(store.patternStart).toHaveLength(1);
		expect(store.getDistance(2)).toBeNaN();
	});

	it("restitue pour chaque stop_time les valeurs d'entrée", () => {
		const trips: TripInput[] = [
			{
				stops: [A, B, C],
				sequences: [1, 2, 3],
				flags: [0, 1, 2],
				distances: [0, 1000, 2000],
				headsigns: ["Vers C", undefined, undefined],
				departures: [100, 200, 300],
			},
			{ stops: [C, A], sequences: [5, 9], distances: [0, Number.NaN], departures: [400, 500] },
			{
				stops: [A, B, C],
				sequences: [1, 2, 3],
				flags: [0, 1, 2],
				distances: [0, 1000, 2000],
				headsigns: ["Vers C", undefined, undefined],
				departures: [600, 700, 800],
			},
		];
		const store = buildStore(trips);

		const actual = Array.from({ length: store.size }, (_, index) => ({
			stop: store.getStop(index).id,
			sequence: store.getSequence(index),
			flags: store.getFlags(index),
			distance: store.getDistance(index),
			headsign: store.getStopHeadsign(index),
		}));
		const expected = trips.flatMap((trip) =>
			trip.stops.map((stop, i) => ({
				stop: stop.id,
				sequence: trip.sequences[i],
				flags: trip.flags?.[i] ?? 0,
				distance: trip.distances?.[i] ?? Number.NaN,
				headsign: trip.headsigns?.[i],
			})),
		);

		expect(actual).toEqual(expected);
		expect(store.patternStart).toHaveLength(2);
	});

	it("compacte sans erreur des courses d'un ou d'aucun stop_time", () => {
		const store = buildStore([
			{ stops: [A], sequences: [1], departures: [100] },
			{ stops: [], sequences: [], departures: [] },
			{ stops: [B, C], sequences: [1, 2], departures: [200, 300] },
		]);

		expect(store.patternStart).toHaveLength(2);
		expect([0, 1, 2].map((index) => store.getStop(index).id)).toEqual(["a", "b", "c"]);
		expect(store.tripOf(1)).toBe(2);
	});
});

describe("assignTripPatterns", () => {
	it("borne les comparaisons quand toutes les empreintes collisionnent", () => {
		const tripTotal = 50_000;
		const tripStart = Uint32Array.from({ length: tripTotal }, (_, trip) => trip);
		const tripCount = new Uint32Array(tripTotal).fill(1);
		let comparisons = 0;

		const { tripPattern, representativeStarts } = assignTripPatterns(
			tripStart,
			tripCount,
			() => 0,
			(a, b) => {
				comparisons += 1;
				return a === b;
			},
		);

		expect(comparisons).toBeLessThanOrEqual(tripTotal * MAX_PATTERN_CANDIDATES);
		expect(representativeStarts).toHaveLength(tripTotal);
		for (let trip = 0; trip < tripTotal; trip += 1) {
			expect(representativeStarts[tripPattern[trip]!]).toBe(trip);
		}
	});

	it("partage encore un parcours entre courses identiques malgré les collisions", () => {
		const slices = [0, 1, 0, 2, 1, 0];
		const { tripPattern, representativeStarts } = assignTripPatterns(
			Uint32Array.from(slices.keys()),
			new Uint32Array(slices.length).fill(1),
			() => 0,
			(a, b) => slices[a] === slices[b],
		);

		expect(representativeStarts).toHaveLength(3);
		expect(Array.from(tripPattern)).toEqual([0, 1, 0, 2, 1, 0]);
	});
});

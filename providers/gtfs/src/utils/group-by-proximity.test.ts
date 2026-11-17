import { describe, expect, it } from "vitest";

import { getDistance } from "./get-distance.js";
import { groupByProximity } from "./group-by-proximity.js";

type Point = { id: number; latitude: number; longitude: number };

const getPosition = (point: Point) => point;
const ids = (groups: Point[][]) =>
	groups.map((group) => group.map((point) => point.id).sort((a, b) => a - b)).sort((a, b) => a[0]! - b[0]!);

function naiveGroups(points: Point[], thresholdMeters: number) {
	const parents = points.map((_, index) => index);
	const find = (index: number): number => {
		let root = index;
		while (parents[root] !== root) root = parents[root]!;
		return root;
	};
	for (let i = 0; i < points.length; i++) {
		for (let j = i + 1; j < points.length; j++) {
			const a = points[i]!;
			const b = points[j]!;
			if (getDistance(a.latitude, a.longitude, b.latitude, b.longitude) <= thresholdMeters) {
				parents[find(j)] = find(i);
			}
		}
	}
	const groups = new Map<number, Point[]>();
	points.forEach((point, index) => {
		const root = find(index);
		groups.set(root, [...(groups.get(root) ?? []), point]);
	});
	return [...groups.values()];
}

function seededRandom(seed: number) {
	return () => {
		seed = (Math.imul(seed, 1_664_525) + 1_013_904_223) >>> 0;
		return seed / 2 ** 32;
	};
}

describe("groupByProximity", () => {
	it("chains points that are close one after another", () => {
		const points = [
			{ id: 0, latitude: 48.8566, longitude: 2.3522 },
			{ id: 1, latitude: 48.85662, longitude: 2.3522 },
			{ id: 2, latitude: 48.85664, longitude: 2.3522 },
			{ id: 3, latitude: 48.857, longitude: 2.3522 },
		];

		expect(ids(groupByProximity(points, getPosition, 3))).toEqual([[0, 1, 2], [3]]);
	});

	it("matches a pairwise comparison at several latitudes", () => {
		const random = seededRandom(42);
		for (const [latitude, longitude] of [
			[-21.1151, 55.5364],
			[0, 0],
			[45.764, 4.8357],
			[48.8566, -2.3522],
			[60.1699, 24.9384],
		] as const) {
			const points = Array.from({ length: 400 }, (_, id) => ({
				id,
				latitude: latitude + (random() - 0.5) * 0.0004,
				longitude: longitude + (random() - 0.5) * 0.0006,
			}));

			for (const threshold of [3, 5]) {
				expect(ids(groupByProximity(points, getPosition, threshold))).toEqual(ids(naiveGroups(points, threshold)));
			}
		}
	});

	it("keeps each point with invalid coordinates in its own group", () => {
		const points = [
			{ id: 0, latitude: Number.NaN, longitude: Number.NaN },
			{ id: 1, latitude: Number.NaN, longitude: Number.NaN },
			{ id: 2, latitude: Number.POSITIVE_INFINITY, longitude: 2 },
			{ id: 3, latitude: 48.8566, longitude: 200 },
		];

		expect(ids(groupByProximity(points, getPosition, 3))).toEqual([[0], [1], [2], [3]]);
	});

	it("groups 10 000 points at the same place in linear time", () => {
		const points = Array.from({ length: 10_000 }, (_, id) => ({ id, latitude: 45.764, longitude: 4.8357 }));

		const startedAt = performance.now();
		const groups = groupByProximity(points, getPosition, 3);

		expect(performance.now() - startedAt).toBeLessThan(100);
		expect(groups).toHaveLength(1);
	});

	it("handles 10 000 points with invalid coordinates in linear time", () => {
		const points = Array.from({ length: 10_000 }, (_, id) => ({ id, latitude: Number.NaN, longitude: Number.NaN }));

		const startedAt = performance.now();
		const groups = groupByProximity(points, getPosition, 3);

		expect(performance.now() - startedAt).toBeLessThan(100);
		expect(groups).toHaveLength(10_000);
	});
});

import { describe, expect, it } from "vitest";
import { buildMergedLinePathFromShapes } from "./line-path.js";
import { Shape } from "./shape.js";

function shape(id: string, points: [number, number][]) {
	const rawPoints = new Float64Array(points.length * 3);
	for (let i = 0; i < points.length; i++) {
		rawPoints[i * 3] = points[i]![0];
		rawPoints[i * 3 + 1] = points[i]![1];
		rawPoints[i * 3 + 2] = i;
	}

	return new Shape(id, rawPoints);
}

function segmentKey(segment: [number, number][]) {
	return segment.map(([lat, lon]) => `${lat.toFixed(5)},${lon.toFixed(5)}`).join(" ");
}

describe("buildMergedLinePathFromShapes", () => {
	it("keeps branches and disconnected parts without duplicating shared edges", () => {
		const result = buildMergedLinePathFromShapes([
			shape("main", [
				[49, 1],
				[49, 1.01],
				[49, 1.02],
			]),
			shape("branch", [
				[49, 1],
				[49, 1.01],
				[49.01, 1.01],
			]),
			shape("detached", [
				[49.1, 1.1],
				[49.1, 1.11],
			]),
		]);

		const segments = new Set(result.segments.map(segmentKey));

		expect(segments).toEqual(
			new Set([
				"49.00000,1.00000 49.00000,1.01000",
				"49.00000,1.01000 49.00000,1.02000",
				"49.00000,1.01000 49.01000,1.01000",
				"49.10000,1.10000 49.10000,1.11000",
			]),
		);
	});

	it("deduplicates identical shapes", () => {
		const result = buildMergedLinePathFromShapes([
			shape("a", [
				[49, 1],
				[49, 1.01],
			]),
			shape("b", [
				[49, 1],
				[49, 1.01],
			]),
		]);

		expect(result.segments.map(segmentKey)).toEqual(["49.00000,1.00000 49.00000,1.01000"]);
	});

	it("keeps intermediate source points", () => {
		const result = buildMergedLinePathFromShapes([
			shape("source", [
				[49, 1],
				[49.00001, 1.00001],
				[49.00002, 1.00002],
			]),
		]);

		expect(result.segments).toEqual([
			[
				[49, 1],
				[49.00001, 1.00001],
				[49.00002, 1.00002],
			],
		]);
	});
});

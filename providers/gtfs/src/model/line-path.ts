import { type EncodedLinePath, encodeLinePath, type LinePath } from "@bus-tracker/contracts";

import type { Gtfs } from "./gtfs.js";
import type { Journey } from "./journey.js";
import type { Shape } from "./shape.js";
import type { Source } from "./source.js";

const SIMPLIFICATION_TOLERANCE_METERS = 10;
const SNAP_PRECISION = 100000;

type NodeKey = `${number},${number}`;

type Edge = {
	a: NodeKey;
	b: NodeKey;
};

function pointToKey([lat, lon]: [number, number]): NodeKey {
	return `${Math.round(lat * SNAP_PRECISION)},${Math.round(lon * SNAP_PRECISION)}`;
}

function keyToPoint(key: NodeKey): [number, number] {
	const [lat, lon] = key.split(",").map(Number);
	return [lat! / SNAP_PRECISION, lon! / SNAP_PRECISION];
}

function edgeKey(a: NodeKey, b: NodeKey) {
	return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function distanceToSegmentMeters(
	point: [number, number],
	segmentStart: [number, number],
	segmentEnd: [number, number],
) {
	const latFactor = 111_320;
	const lonFactor = Math.cos(((segmentStart[0] + segmentEnd[0]) / 2) * (Math.PI / 180)) * latFactor;

	const px = (point[1] - segmentStart[1]) * lonFactor;
	const py = (point[0] - segmentStart[0]) * latFactor;
	const sx = 0;
	const sy = 0;
	const ex = (segmentEnd[1] - segmentStart[1]) * lonFactor;
	const ey = (segmentEnd[0] - segmentStart[0]) * latFactor;
	const dx = ex - sx;
	const dy = ey - sy;

	if (dx === 0 && dy === 0) return Math.hypot(px, py);

	const t = Math.max(0, Math.min(1, ((px - sx) * dx + (py - sy) * dy) / (dx * dx + dy * dy)));
	return Math.hypot(px - (sx + t * dx), py - (sy + t * dy));
}

function simplifyPoints(points: [number, number][], toleranceMeters: number, protectedKeys: Set<NodeKey>) {
	if (points.length <= 2) return points;

	const keep = new Uint8Array(points.length);
	keep[0] = 1;
	keep[points.length - 1] = 1;
	for (let i = 1; i < points.length - 1; i++) {
		if (protectedKeys.has(pointToKey(points[i]!))) keep[i] = 1;
	}

	const stack: [number, number][] = [[0, points.length - 1]];
	while (stack.length > 0) {
		const [start, end] = stack.pop()!;
		let maxDistance = 0;
		let maxIndex = -1;

		for (let i = start + 1; i < end; i++) {
			const distance = distanceToSegmentMeters(points[i]!, points[start]!, points[end]!);
			if (distance > maxDistance) {
				maxDistance = distance;
				maxIndex = i;
			}
		}

		if (maxDistance > toleranceMeters && maxIndex !== -1) {
			keep[maxIndex] = 1;
			stack.push([start, maxIndex], [maxIndex, end]);
		}
	}

	return points.filter((_, index) => keep[index] === 1);
}

function shapeToPoints(shape: Shape) {
	const points: [number, number][] = [];
	for (let i = 0; i < shape.length; i++) {
		points.push(shape.getPoint(i));
	}
	return points;
}

function shapeToSimplifiedKeys(shape: Shape, protectedKeys: Set<NodeKey>) {
	const points = shapeToPoints(shape);
	const keys: NodeKey[] = [];
	for (const point of simplifyPoints(points, SIMPLIFICATION_TOLERANCE_METERS, protectedKeys)) {
		const key = pointToKey(point);
		if (keys.at(-1) !== key) keys.push(key);
	}

	return keys;
}

export function buildMergedLinePathFromShapes(shapes: Iterable<Shape>): LinePath {
	const shapeList = Array.from(shapes);
	const pointCounts = new Map<NodeKey, number>();
	for (const shape of shapeList) {
		const shapeKeys = new Set(shapeToPoints(shape).map(pointToKey));
		for (const key of shapeKeys) {
			pointCounts.set(key, (pointCounts.get(key) ?? 0) + 1);
		}
	}

	const protectedKeys = new Set<NodeKey>();
	for (const [key, count] of pointCounts) {
		if (count > 1) protectedKeys.add(key);
	}

	const edges = new Map<string, Edge>();
	const adjacency = new Map<NodeKey, Set<string>>();

	for (const shape of shapeList) {
		const keys = shapeToSimplifiedKeys(shape, protectedKeys);
		for (let i = 1; i < keys.length; i++) {
			const a = keys[i - 1]!;
			const b = keys[i]!;
			if (a === b) continue;

			const key = edgeKey(a, b);
			if (edges.has(key)) continue;

			edges.set(key, { a, b });

			let aEdges = adjacency.get(a);
			if (aEdges === undefined) {
				aEdges = new Set();
				adjacency.set(a, aEdges);
			}
			aEdges.add(key);

			let bEdges = adjacency.get(b);
			if (bEdges === undefined) {
				bEdges = new Set();
				adjacency.set(b, bEdges);
			}
			bEdges.add(key);
		}
	}

	const visited = new Set<string>();
	const segments: [number, number][][] = [];

	const trace = (start: NodeKey, firstEdgeKey: string) => {
		const path: NodeKey[] = [start];
		let current = start;
		let currentEdgeKey: string | undefined = firstEdgeKey;

		while (currentEdgeKey !== undefined && !visited.has(currentEdgeKey)) {
			visited.add(currentEdgeKey);

			const edge = edges.get(currentEdgeKey)!;
			current = edge.a === current ? edge.b : edge.a;
			path.push(current);

			const nextEdges = adjacency.get(current);
			if (nextEdges === undefined) break;
			if (nextEdges.size !== 2) break;

			currentEdgeKey = Array.from(nextEdges).find((candidate) => !visited.has(candidate));
		}

		if (path.length >= 2) segments.push(path.map(keyToPoint));
	};

	for (const [nodeKey, nodeEdges] of adjacency) {
		if (nodeEdges.size === 2) continue;
		for (const candidate of nodeEdges) {
			if (!visited.has(candidate)) trace(nodeKey, candidate);
		}
	}

	for (const [candidate, edge] of edges) {
		if (!visited.has(candidate)) trace(edge.a, candidate);
	}

	return { segments };
}

export function buildEncodedLinePaths(source: Source, gtfs: Gtfs): Map<string, EncodedLinePath> {
	const shapesByLinePathRef = new Map<string, Map<string, Shape>>();

	if (source.options.disableRoutePaths) return new Map();

	for (const trip of gtfs.trips.values()) {
		if (trip.shape === undefined) continue;

		const networkRef = source.options.getNetworkRef({ trip } as Journey);
		if (networkRef === undefined) continue;

		const lineRef = `${networkRef}:Line:${source.options.mapLineRef?.(trip.route.id) ?? trip.route.id}`;
		const linePathRef = `${lineRef}:LinePath`;

		let lineShapes = shapesByLinePathRef.get(linePathRef);
		if (lineShapes === undefined) {
			lineShapes = new Map();
			shapesByLinePathRef.set(linePathRef, lineShapes);
		}

		lineShapes.set(trip.shape.id, trip.shape);
	}

	const linePaths = new Map<string, EncodedLinePath>();
	for (const [linePathRef, shapes] of shapesByLinePathRef) {
		const linePath = buildMergedLinePathFromShapes(shapes.values());
		if (linePath.segments.length > 0) {
			linePaths.set(linePathRef, encodeLinePath(linePath));
		}
	}

	return linePaths;
}

import { type EncodedLinePath, encodeLinePath, type LinePath } from "@bus-tracker/contracts";

import type { Gtfs } from "./gtfs.js";
import type { Journey } from "./journey.js";
import type { Shape } from "./shape.js";
import type { Source } from "./source.js";

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

function shapeToPoints(shape: Shape) {
	const points: [number, number][] = [];
	for (let i = 0; i < shape.length; i++) {
		points.push(shape.getPoint(i));
	}
	return points;
}

function shapeToKeys(shape: Shape) {
	const points = shapeToPoints(shape);
	const keys: NodeKey[] = [];
	for (const point of points) {
		const key = pointToKey(point);
		if (keys.at(-1) !== key) keys.push(key);
	}

	return keys;
}

export function buildMergedLinePathFromShapes(shapes: Iterable<Shape>): LinePath {
	const shapeList = Array.from(shapes);

	const edges = new Map<string, Edge>();
	const adjacency = new Map<NodeKey, Set<string>>();

	for (const shape of shapeList) {
		const keys = shapeToKeys(shape);
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

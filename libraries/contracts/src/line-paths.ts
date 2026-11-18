import type { VehicleJourneyPath } from "./vehicle-journeys.js";

export type LinePath = {
	segments: [number, number][][];
};

export type EncodedLinePath = {
	v: 1 | 2;
	segments: string[];
};

/** Durée de vie des tracés de ligne dans Redis : largement au-delà de leur rafraîchissement. */
export const LINE_PATH_TTL_SECONDS = 172_800;

/** La v1 arrondissait au mètre près, ce qui crénelait les tracés ; la v2 garde celle des tracés de course. */
const LINE_PATH_FACTOR_BY_VERSION = { 1: 100000, 2: 1000000 } as const;
const LINE_PATH_FACTOR = LINE_PATH_FACTOR_BY_VERSION[2];

const JOURNEY_PATH_COORDINATE_FACTOR = 1000000;
const JOURNEY_PATH_DISTANCE_FACTOR = 1000;
const MISSING_DISTANCE = "!";

function encodeSignedNumber(value: number) {
	let current = value < 0 ? -2 * value - 1 : 2 * value;
	let output = "";

	while (current >= 0x20) {
		output += String.fromCharCode((0x20 | (current % 0x20)) + 63);
		current = Math.floor(current / 0x20);
	}

	return output + String.fromCharCode(current + 63);
}

function encodePoints(points: Iterable<readonly [number, number, ...unknown[]]>, factor: number) {
	const parts: string[] = [];
	let previousLat = 0;
	let previousLon = 0;

	for (const [lat, lon] of points) {
		const currentLat = Math.round(lat * factor);
		const currentLon = Math.round(lon * factor);
		parts.push(encodeSignedNumber(currentLat - previousLat), encodeSignedNumber(currentLon - previousLon));
		previousLat = currentLat;
		previousLon = currentLon;
	}

	return parts.join("");
}

function createSignedNumberReader(encoded: string) {
	let index = 0;

	return {
		get done() {
			return index >= encoded.length;
		},
		skipMissing() {
			if (encoded[index] !== MISSING_DISTANCE) return false;
			index += 1;
			return true;
		},
		/** `undefined` si la chaîne s'achève au milieu d'un nombre. */
		read() {
			let result = 0;
			let factor = 1;
			let byte = 0;

			do {
				if (index >= encoded.length) return undefined;
				byte = encoded.charCodeAt(index++) - 63;
				result += (byte & 0x1f) * factor;
				factor *= 0x20;
			} while (byte >= 0x20);

			return result % 2 === 1 ? -(result + 1) / 2 : result / 2;
		},
	};
}

/**
 * Décode une polyligne (algorithme Google) en couples latitude/longitude. Une chaîne tronquée donne un
 * tableau vide : un tracé partiel replacerait silencieusement les véhicules au mauvais endroit.
 */
export function decodePolyline(encoded: string, factor: number): [number, number][] {
	const reader = createSignedNumberReader(encoded);
	const points: [number, number][] = [];
	let lat = 0;
	let lon = 0;

	while (!reader.done) {
		const deltaLat = reader.read();
		const deltaLon = reader.read();
		if (deltaLat === undefined || deltaLon === undefined) return [];
		lat += deltaLat;
		lon += deltaLon;
		points.push([lat / factor, lon / factor]);
	}

	return points;
}

export function encodeLinePath(linePath: LinePath): EncodedLinePath {
	return { v: 2, segments: linePath.segments.map((segment) => encodePoints(segment, LINE_PATH_FACTOR)) };
}

export function decodeLinePath(encodedLinePath: EncodedLinePath): LinePath {
	const factor = LINE_PATH_FACTOR_BY_VERSION[encodedLinePath.v];
	return {
		segments: encodedLinePath.segments.flatMap((segment) => {
			const points = decodePolyline(segment, factor);
			return points.length >= 2 ? [points] : [];
		}),
	};
}

export type EncodedJourneyPath = {
	v: 1;
	points: string;
	distances?: string;
};

export function encodeJourneyPath(path: VehicleJourneyPath): EncodedJourneyPath {
	const points = encodePoints(path.p, JOURNEY_PATH_COORDINATE_FACTOR);
	if (!path.p.some((point) => point[2] !== undefined)) return { v: 1, points };

	const distanceParts: string[] = [];
	let previousDistance = 0;

	for (const [, , distance] of path.p) {
		if (distance === undefined) {
			distanceParts.push(MISSING_DISTANCE);
			continue;
		}

		const currentDistance = Math.round(distance * JOURNEY_PATH_DISTANCE_FACTOR);
		distanceParts.push(encodeSignedNumber(currentDistance - previousDistance));
		previousDistance = currentDistance;
	}

	return { v: 1, points, distances: distanceParts.join("") };
}

export function decodeJourneyPath(encodedPath: EncodedJourneyPath): VehicleJourneyPath {
	const coordinates = decodePolyline(encodedPath.points, JOURNEY_PATH_COORDINATE_FACTOR);
	if (encodedPath.distances === undefined) return { p: coordinates };

	const distances = createSignedNumberReader(encodedPath.distances);
	let distance = 0;

	return {
		p: coordinates.map(([lat, lon]) => {
			if (distances.done || distances.skipMissing()) return [lat, lon];
			distance += distances.read() ?? 0;
			return [lat, lon, distance / JOURNEY_PATH_DISTANCE_FACTOR];
		}),
	};
}

export type EncodedVehicleJourneyPaths = {
	path: EncodedJourneyPath;
	cancelled?: EncodedLinePath;
};

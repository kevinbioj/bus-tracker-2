import type { VehicleJourneyPath } from "./vehicle-journeys.js";

export type LinePath = {
	segments: [number, number][][];
};

export type EncodedLinePath = {
	v: 1 | 2;
	segments: string[];
};

/** Précision des coordonnées selon la version d'encodage : la v1 arrondissait au mètre près, ce qui
 * crénelait les tracés ; la v2 garde celle des tracés de course (1e-6). */
const PRECISION_BY_VERSION = { 1: 100000, 2: 1000000 } as const;
const PRECISION = PRECISION_BY_VERSION[2];

function encodeSigned(value: number) {
	let current = value < 0 ? ~(value << 1) : value << 1;
	let output = "";

	while (current >= 0x20) {
		output += String.fromCharCode((0x20 | (current & 0x1f)) + 63);
		current >>= 5;
	}

	return output + String.fromCharCode(current + 63);
}

function decodeSigned(value: number) {
	return value & 1 ? ~(value >> 1) : value >> 1;
}

export function encodeLinePath(linePath: LinePath): EncodedLinePath {
	return {
		v: 2,
		segments: linePath.segments.map((segment) => {
			let previousLat = 0;
			let previousLon = 0;
			let output = "";

			for (const [lat, lon] of segment) {
				const currentLat = Math.round(lat * PRECISION);
				const currentLon = Math.round(lon * PRECISION);

				output += encodeSigned(currentLat - previousLat);
				output += encodeSigned(currentLon - previousLon);

				previousLat = currentLat;
				previousLon = currentLon;
			}

			return output;
		}),
	};
}

export function decodeLinePath(encodedLinePath: EncodedLinePath): LinePath {
	const precision = PRECISION_BY_VERSION[encodedLinePath.v];

	return {
		segments: encodedLinePath.segments.flatMap((segment) => {
			const points: [number, number][] = [];
			let previousLat = 0;
			let previousLon = 0;
			let index = 0;

			while (index < segment.length) {
				let result = 0;
				let shift = 0;
				let byte = 0;

				do {
					byte = segment.charCodeAt(index++) - 63;
					result |= (byte & 0x1f) << shift;
					shift += 5;
				} while (byte >= 0x20);

				previousLat += decodeSigned(result);

				result = 0;
				shift = 0;

				do {
					byte = segment.charCodeAt(index++) - 63;
					result |= (byte & 0x1f) << shift;
					shift += 5;
				} while (byte >= 0x20);

				previousLon += decodeSigned(result);
				points.push([previousLat / precision, previousLon / precision]);
			}

			return points.length >= 2 ? [points] : [];
		}),
	};
}

export type EncodedJourneyPath = {
	v: 1;
	points: string;
	distances?: string;
};

const JOURNEY_PATH_COORDINATE_PRECISION = 1000000;
const JOURNEY_PATH_DISTANCE_PRECISION = 1000;
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
		read() {
			let result = 0;
			let factor = 1;
			let byte = 0;

			do {
				byte = encoded.charCodeAt(index++) - 63;
				result += (byte & 0x1f) * factor;
				factor *= 0x20;
			} while (byte >= 0x20);

			return result % 2 === 1 ? -(result + 1) / 2 : result / 2;
		},
	};
}

export function encodeJourneyPath(path: VehicleJourneyPath): EncodedJourneyPath {
	let points = "";
	let previousLat = 0;
	let previousLon = 0;

	for (const [lat, lon] of path.p) {
		const currentLat = Math.round(lat * JOURNEY_PATH_COORDINATE_PRECISION);
		const currentLon = Math.round(lon * JOURNEY_PATH_COORDINATE_PRECISION);
		points += encodeSignedNumber(currentLat - previousLat) + encodeSignedNumber(currentLon - previousLon);
		previousLat = currentLat;
		previousLon = currentLon;
	}

	if (!path.p.some((point) => point[2] !== undefined)) return { v: 1, points };

	let distances = "";
	let previousDistance = 0;

	for (const [, , distance] of path.p) {
		if (distance === undefined) {
			distances += MISSING_DISTANCE;
			continue;
		}

		const currentDistance = Math.round(distance * JOURNEY_PATH_DISTANCE_PRECISION);
		distances += encodeSignedNumber(currentDistance - previousDistance);
		previousDistance = currentDistance;
	}

	return { v: 1, points, distances };
}

export function decodeJourneyPath(encodedPath: EncodedJourneyPath): VehicleJourneyPath {
	const points = createSignedNumberReader(encodedPath.points);
	const distances = encodedPath.distances !== undefined ? createSignedNumberReader(encodedPath.distances) : undefined;
	const p: VehicleJourneyPath["p"] = [];

	let lat = 0;
	let lon = 0;
	let distance = 0;

	while (!points.done) {
		lat += points.read();
		lon += points.read();

		if (distances === undefined || distances.done || distances.skipMissing()) {
			p.push([lat / JOURNEY_PATH_COORDINATE_PRECISION, lon / JOURNEY_PATH_COORDINATE_PRECISION]);
			continue;
		}

		distance += distances.read();
		p.push([
			lat / JOURNEY_PATH_COORDINATE_PRECISION,
			lon / JOURNEY_PATH_COORDINATE_PRECISION,
			distance / JOURNEY_PATH_DISTANCE_PRECISION,
		]);
	}

	return { p };
}

export type EncodedVehicleJourneyPaths = {
	path: EncodedJourneyPath;
	cancelled?: EncodedLinePath;
};

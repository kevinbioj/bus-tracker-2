import { Shape } from "../model/shape.js";

import { getDistance } from "./get-distance.js";

/**
 * Décode une polyligne encodée (algorithme Google, précision 5 par défaut) en couples
 * latitude/longitude. Les valeurs sont stockées en deltas signés à variable-length encoding :
 * chaque groupe de 5 bits est décalé de 63 et porte un bit de continuation.
 *
 * Renvoie un tableau vide si la chaîne est tronquée : un flux malformé ne doit pas produire un
 * tracé partiel, qui replacerait silencieusement les véhicules au mauvais endroit.
 */
export function decodePolyline(encoded: string, precision = 5): [number, number][] {
	const factor = 10 ** precision;
	const points: [number, number][] = [];

	let index = 0;
	let latitude = 0;
	let longitude = 0;

	while (index < encoded.length) {
		let shift = 0;
		let result = 0;
		let byte: number;

		do {
			if (index >= encoded.length) return [];
			byte = encoded.charCodeAt(index++) - 63;
			result |= (byte & 0x1f) << shift;
			shift += 5;
		} while (byte >= 0x20);

		latitude += result & 1 ? ~(result >> 1) : result >> 1;

		shift = 0;
		result = 0;

		do {
			if (index >= encoded.length) return [];
			byte = encoded.charCodeAt(index++) - 63;
			result |= (byte & 0x1f) << shift;
			shift += 5;
		} while (byte >= 0x20);

		longitude += result & 1 ? ~(result >> 1) : result >> 1;

		points.push([latitude / factor, longitude / factor]);
	}

	return points;
}

/**
 * Construit un {@link Shape} à partir d'une polyligne encodée publiée par un flux temps réel.
 *
 * Ces tracés ne portent jamais de distance curviligne : elle est calculée par cumul des distances
 * entre points, comme le fait l'import statique lorsque `shape_dist_traveled` manque. Le tracé est
 * donc marqué `recalculatedDistances` — les `shape_dist_traveled` du GTFS statique ne sont pas
 * comparables aux siennes, et les arrêts repris d'un horaire théorique doivent être reprojetés.
 *
 * @returns undefined si la polyligne ne contient pas au moins deux points (spec).
 */
export function createShapeFromPolyline(id: string, encodedPolyline: string): Shape | undefined {
	const points = decodePolyline(encodedPolyline);
	if (points.length < 2) return;

	const typedPoints = new Float64Array(points.length * 3);

	let distance = 0;
	for (let i = 0; i < points.length; i++) {
		const [latitude, longitude] = points[i]!;

		if (i > 0) {
			const [previousLatitude, previousLongitude] = points[i - 1]!;
			distance += getDistance(previousLatitude, previousLongitude, latitude, longitude);
		}

		typedPoints[i * 3] = latitude;
		typedPoints[i * 3 + 1] = longitude;
		typedPoints[i * 3 + 2] = distance;
	}

	return new Shape(id, typedPoints, true);
}

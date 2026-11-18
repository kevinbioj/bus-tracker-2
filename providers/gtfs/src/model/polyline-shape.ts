import { decodePolyline } from "@bus-tracker/contracts";
import { getDistance } from "../utils/get-distance.js";
import { Shape } from "./shape.js";

/** Précision des polylignes publiées par les flux temps réel (algorithme Google, 5 décimales). */
const POLYLINE_FACTOR = 1e5;

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
	const points = decodePolyline(encodedPolyline, POLYLINE_FACTOR);
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

	return new Shape(id, typedPoints, true, true);
}

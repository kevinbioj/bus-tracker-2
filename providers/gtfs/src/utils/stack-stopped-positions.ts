import type { VehicleJourney } from "@bus-tracker/contracts";

import type { Shape } from "../model/shape.js";
import { groupByProximity } from "./group-by-proximity.js";

/**
 * Distance (m) en deçà de laquelle deux véhicules à l'arrêt sont tenus pour stationner au même
 * point. Deux lignes desservant le même arrêt ont chacune leur tracé, qui ne se superposent jamais
 * au mètre près : le seuil absorbe cet écart, sans atteindre celui de deux arrêts distincts.
 */
const STOPPED_OVERLAP_THRESHOLD_METERS = 5;

/** Écart (m) le long du tracé entre deux véhicules consécutifs d'une file à l'arrêt. */
const QUEUE_SPACING_METERS = 3;

type StoppedJourney = {
	vehicleJourney: VehicleJourney;
	position: NonNullable<VehicleJourney["position"]> & { distanceTraveled: number };
	shape: Shape;
	arrivedAtMs: number;
};

/**
 * Met en file les véhicules à l'arrêt au même point : le premier arrivé reste au droit de l'arrêt,
 * les suivants sont reculés sur leur propre tracé de {@link QUEUE_SPACING_METERS} par rang. Sans
 * cela, les positions calculées de plusieurs courses à l'arrêt se confondent en un seul marqueur.
 *
 * Seules les positions calculées sont concernées : elles seules sont ancrées au tracé par leur
 * distance curviligne. L'ordre d'arrivée rend la file stable d'un cycle à l'autre — un véhicule qui
 * arrive se place derrière ceux déjà présents, et le départ du premier fait avancer les suivants.
 *
 * @param getShape Tracé sur lequel la position de la course a été calculée.
 * @returns Le nombre de véhicules effectivement reculés.
 */
export function stackStoppedPositions(
	vehicleJourneys: Iterable<VehicleJourney>,
	getShape: (vehicleJourney: VehicleJourney) => Shape | undefined,
) {
	const candidates: StoppedJourney[] = [];
	for (const vehicleJourney of vehicleJourneys) {
		const position = vehicleJourney.position;
		if (position?.type !== "COMPUTED" || !position.atStop) continue;

		const { distanceTraveled } = position;
		if (distanceTraveled === undefined || !Number.isFinite(distanceTraveled)) continue;

		const shape = getShape(vehicleJourney);
		if (shape === undefined) continue;

		// Une position calculée à l'arrêt est datée de l'arrivée à cet arrêt.
		const arrivedAtMs = Date.parse(position.recordedAt);
		candidates.push({
			vehicleJourney,
			position: { ...position, distanceTraveled },
			shape,
			arrivedAtMs: Number.isNaN(arrivedAtMs) ? Number.POSITIVE_INFINITY : arrivedAtMs,
		});
	}
	if (candidates.length < 2) return 0;

	let stackedCount = 0;

	for (const queue of groupByProximity(
		candidates,
		(candidate) => candidate.position,
		STOPPED_OVERLAP_THRESHOLD_METERS,
	)) {
		if (queue.length < 2) continue;

		// L'identifiant départage les arrivées simultanées indépendamment de l'ordre d'itération du
		// flux, qui n'est pas garanti stable.
		queue.sort(
			(a, b) =>
				a.arrivedAtMs - b.arrivedAtMs ||
				(a.vehicleJourney.id < b.vehicleJourney.id ? -1 : a.vehicleJourney.id > b.vehicleJourney.id ? 1 : 0),
		);

		for (let rank = 1; rank < queue.length; rank++) {
			const { vehicleJourney, position, shape } = queue[rank]!;

			// Avant le début du tracé (véhicules en attente au départ), l'interpolation prolonge son
			// premier segment : la file reste alignée sur la voie d'où part la course.
			const distanceTraveled = position.distanceTraveled - rank * QUEUE_SPACING_METERS;
			const point = shape.interpolateAt(distanceTraveled);
			if (point === undefined) continue;

			vehicleJourney.position = {
				...position,
				latitude: point.latitude,
				longitude: point.longitude,
				bearing: point.bearing,
				distanceTraveled,
			};
			stackedCount += 1;
		}
	}

	return stackedCount;
}

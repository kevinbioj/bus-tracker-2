import type { Stop } from "./stop.js";

/**
 * Stockage columnar des stop_times d'un GTFS. Chaque trip détient un slice
 * `[stopTimeStart, stopTimeStart + stopTimeCount)` dans ces tableaux parallèles.
 *
 * Encodage des heures : secondes depuis minuit du jour 0 du voyage, modulus
 * inclus. Une stop à 25:30:00 est stockée comme 91800 (= 25*3600 + 30*60).
 */
export class StopTimeStore {
	constructor(
		public stops: Stop[],
		public sequence: Uint32Array,
		public flagsBitmask: Uint8Array,
		public arrivalSecs: Uint32Array,
		public departureSecs: Uint32Array,
		/** Distance traveled en mètres ; NaN si inconnue. */
		public distanceTraveled: Float32Array,
	) {}

	get size(): number {
		return this.sequence.length;
	}
}

import type { Stop } from "./stop.js";

/**
 * Stockage columnar des stop_times et des données par trip d'un GTFS.
 *
 * Encodage des heures : secondes depuis minuit du jour 0 du voyage, modulus
 * inclus. Une stop à 25:30:00 est stockée comme 91800 (= 25*3600 + 30*60).
 */
export class StopTimeStore {
	constructor(
		// --- Tableaux par stop_time (length = totalStopTimes)
		public stops: Stop[],
		public sequence: Uint8Array,
		public flagsBitmask: Uint8Array,
		public arrivalSecs: Uint32Array,
		public departureSecs: Uint32Array,
		/** Distance traveled en mètres ; NaN si inconnue. */
		public distanceTraveled: Float32Array,
		// --- Tableaux par trip (length = totalTrips)
		public tripStart: Uint32Array,
		public tripCount: Uint32Array,
		public tripFirstArrivalSecs: Uint32Array,
		public tripLastArrivalSecs: Uint32Array,
		public tripLastDepartureSecs: Uint32Array,
	) {}

	get size(): number {
		return this.sequence.length;
	}
}

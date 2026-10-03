import type { Stop } from "./stop.js";

/**
 * Stockage columnar des stop_times et des données par trip d'un GTFS.
 *
 * Encodage des heures : secondes depuis minuit du jour 0 du voyage, modulus
 * inclus. Une stop à 25:30:00 est stockée comme 91800 (= 25*3600 + 30*60).
 *
 * Les arrêts et girouettes ne sont pas référencés directement mais par leur indice dans une table :
 * un tableau typé coûte deux fois moins qu'un tableau de références, et le ramasse-miettes n'a pas à
 * le parcourir — à des millions de stop_times, c'est autant de marquage épargné à chaque collecte.
 */
export class StopTimeStore {
	constructor(
		/** Table des arrêts, désignés par {@link stopIdx}. */
		public stopList: Stop[],
		// --- Tableaux par stop_time (length = totalStopTimes)
		public stopIdx: Uint32Array,
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
		/** Table des girouettes d'arrêt, désignées par {@link headsignIdx}. L'indice 0 n'en désigne aucune. */
		public headsignList: string[] = [""],
		/** Absent lorsqu'aucun stop_time ne porte de `stop_headsign`. */
		public headsignIdx?: Uint32Array,
	) {}

	/**
	 * Construit un store à partir de l'arrêt et de la girouette de chaque stop_time, plutôt que de
	 * leurs indices. Commode pour les jeux de données construits à la main.
	 */
	static fromStops(
		stops: Stop[],
		sequence: Uint8Array,
		flagsBitmask: Uint8Array,
		arrivalSecs: Uint32Array,
		departureSecs: Uint32Array,
		distanceTraveled: Float32Array,
		tripStart: Uint32Array,
		tripCount: Uint32Array,
		tripFirstArrivalSecs: Uint32Array,
		tripLastArrivalSecs: Uint32Array,
		tripLastDepartureSecs: Uint32Array,
		stopHeadsigns?: (string | undefined)[],
	) {
		const headsignList = [""];
		const headsignIdx =
			stopHeadsigns !== undefined
				? Uint32Array.from(stopHeadsigns, (headsign) => {
						if (headsign === undefined) return 0;
						headsignList.push(headsign);
						return headsignList.length - 1;
					})
				: undefined;

		return new StopTimeStore(
			stops,
			Uint32Array.from(stops.keys()),
			sequence,
			flagsBitmask,
			arrivalSecs,
			departureSecs,
			distanceTraveled,
			tripStart,
			tripCount,
			tripFirstArrivalSecs,
			tripLastArrivalSecs,
			tripLastDepartureSecs,
			headsignList,
			headsignIdx,
		);
	}

	get size(): number {
		return this.stopIdx.length;
	}

	getStop(index: number) {
		return this.stopList[this.stopIdx[index]!]!;
	}

	getStopHeadsign(index: number) {
		const headsignIndex = this.headsignIdx?.[index];
		return headsignIndex ? this.headsignList[headsignIndex] : undefined;
	}

	/** Arrêts desservis par au moins un stop_time, chacun une seule fois. */
	getServedStops() {
		const served = new Uint8Array(this.stopList.length);
		for (const index of this.stopIdx) served[index] = 1;
		return this.stopList.filter((_, index) => served[index] === 1);
	}
}

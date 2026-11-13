import type { Stop } from "./stop.js";

export type SequenceArray = Uint8Array | Uint16Array | Uint32Array;

export function createSequenceArray(maxSequence: number, length: number): SequenceArray {
	if (maxSequence <= 0xff) return new Uint8Array(length);
	if (maxSequence <= 0xffff) return new Uint16Array(length);
	return new Uint32Array(length);
}

export type StopTimeColumns = {
	stopIdx: Uint32Array;
	sequence: SequenceArray;
	flagsBitmask: Uint8Array;
	distanceTraveled: Float32Array;
	headsignIdx?: Uint32Array;
};

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/**
 * Stockage columnar des stop_times et des données par trip d'un GTFS.
 *
 * Encodage des heures : secondes depuis minuit du jour 0 du voyage, modulus
 * inclus. Une stop à 25:30:00 est stockée comme 91800 (= 25*3600 + 30*60).
 *
 * Seules les heures sont stockées par stop_time. Arrêt, séquence, règles de montée et de descente,
 * distance et girouette se répètent à l'identique d'une course à l'autre d'un même parcours : elles
 * sont stockées une fois par parcours, et chaque course désigne le sien par {@link tripPattern}.
 *
 * Les arrêts et girouettes ne sont pas référencés directement mais par leur indice dans une table :
 * un tableau typé coûte deux fois moins qu'un tableau de références, et le ramasse-miettes n'a pas à
 * le parcourir — à des millions de stop_times, c'est autant de marquage épargné à chaque collecte.
 */
export class StopTimeStore {
	tripPattern = new Uint32Array(0);
	patternStart = new Uint32Array(0);
	patternStopIdx = new Uint32Array(0);
	patternSequence: SequenceArray = new Uint8Array(0);
	patternFlags = new Uint8Array(0);
	/** Distance traveled en mètres ; NaN si inconnue. */
	patternDistance = new Float32Array(0);
	/** Absent lorsqu'aucun stop_time ne porte de `stop_headsign`. */
	patternHeadsignIdx: Uint32Array | undefined;
	private tripOrder = new Uint32Array(0);

	constructor(
		/** Table des arrêts, désignés par {@link patternStopIdx}. */
		public stopList: Stop[],
		stopIdx: Uint32Array,
		sequence: SequenceArray,
		flagsBitmask: Uint8Array,
		// --- Tableaux par stop_time (length = totalStopTimes)
		public arrivalSecs: Uint32Array,
		public departureSecs: Uint32Array,
		distanceTraveled: Float32Array,
		// --- Tableaux par trip (length = totalTrips)
		public tripStart: Uint32Array,
		public tripCount: Uint32Array,
		public tripFirstArrivalSecs: Uint32Array,
		public tripLastArrivalSecs: Uint32Array,
		public tripLastDepartureSecs: Uint32Array,
		/** Table des girouettes d'arrêt, désignées par {@link patternHeadsignIdx}. L'indice 0 n'en désigne aucune. */
		public headsignList: string[] = [""],
		headsignIdx?: Uint32Array,
	) {
		this.setStopTimeColumns({ stopIdx, sequence, flagsBitmask, distanceTraveled, headsignIdx });
	}

	/**
	 * Construit un store à partir de l'arrêt et de la girouette de chaque stop_time, plutôt que de
	 * leurs indices. Commode pour les jeux de données construits à la main.
	 */
	static fromStops(
		stops: Stop[],
		sequence: SequenceArray,
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

	setStopTimeColumns(columns: StopTimeColumns) {
		const { tripStart, tripCount } = this;
		const distanceBits = new Uint32Array(
			columns.distanceTraveled.buffer,
			columns.distanceTraveled.byteOffset,
			columns.distanceTraveled.length,
		);

		const sameSlice = (a: number, b: number, count: number) => {
			for (let i = 0; i < count; i += 1) {
				if (columns.stopIdx[a + i] !== columns.stopIdx[b + i]) return false;
				if (columns.sequence[a + i] !== columns.sequence[b + i]) return false;
				if (columns.flagsBitmask[a + i] !== columns.flagsBitmask[b + i]) return false;
				if (distanceBits[a + i] !== distanceBits[b + i]) return false;
				if (columns.headsignIdx !== undefined && columns.headsignIdx[a + i] !== columns.headsignIdx[b + i])
					return false;
			}
			return true;
		};

		const hashSlice = (start: number, count: number) => {
			let hash = FNV_OFFSET_BASIS ^ count;
			const mix = (value: number) => {
				hash = Math.imul(hash ^ value, FNV_PRIME);
			};
			for (let i = start; i < start + count; i += 1) {
				mix(columns.stopIdx[i]!);
				mix(columns.sequence[i]!);
				mix(columns.flagsBitmask[i]!);
				mix(distanceBits[i]!);
				if (columns.headsignIdx !== undefined) mix(columns.headsignIdx[i]!);
			}
			return hash >>> 0;
		};

		const tripPattern = new Uint32Array(tripStart.length);
		const patternsByHash = new Map<number, number[]>();
		const representativeStarts: number[] = [];
		const patternCounts: number[] = [];
		const servedTrips: number[] = [];

		for (let trip = 0; trip < tripStart.length; trip += 1) {
			const count = tripCount[trip]!;
			if (count === 0) continue;
			servedTrips.push(trip);

			const start = tripStart[trip]!;
			const hash = hashSlice(start, count);
			let candidates = patternsByHash.get(hash);
			if (candidates === undefined) {
				candidates = [];
				patternsByHash.set(hash, candidates);
			}

			let pattern = candidates.find(
				(candidate) => patternCounts[candidate] === count && sameSlice(representativeStarts[candidate]!, start, count),
			);
			if (pattern === undefined) {
				pattern = representativeStarts.length;
				representativeStarts.push(start);
				patternCounts.push(count);
				candidates.push(pattern);
			}
			tripPattern[trip] = pattern;
		}

		const patternStart = new Uint32Array(representativeStarts.length);
		let totalLength = 0;
		for (let pattern = 0; pattern < representativeStarts.length; pattern += 1) {
			patternStart[pattern] = totalLength;
			totalLength += patternCounts[pattern]!;
		}

		let maxSequence = 0;
		for (const value of columns.sequence) if (value > maxSequence) maxSequence = value;

		const patternStopIdx = new Uint32Array(totalLength);
		const patternSequence = createSequenceArray(maxSequence, totalLength);
		const patternFlags = new Uint8Array(totalLength);
		const patternDistance = new Float32Array(totalLength);
		const patternHeadsignIdx = columns.headsignIdx !== undefined ? new Uint32Array(totalLength) : undefined;

		for (let pattern = 0; pattern < representativeStarts.length; pattern += 1) {
			const from = representativeStarts[pattern]!;
			const to = patternStart[pattern]!;
			const count = patternCounts[pattern]!;
			patternStopIdx.set(columns.stopIdx.subarray(from, from + count), to);
			patternSequence.set(columns.sequence.subarray(from, from + count), to);
			patternFlags.set(columns.flagsBitmask.subarray(from, from + count), to);
			patternDistance.set(columns.distanceTraveled.subarray(from, from + count), to);
			patternHeadsignIdx?.set(columns.headsignIdx!.subarray(from, from + count), to);
		}

		this.tripPattern = tripPattern;
		this.patternStart = patternStart;
		this.patternStopIdx = patternStopIdx;
		this.patternSequence = patternSequence;
		this.patternFlags = patternFlags;
		this.patternDistance = patternDistance;
		this.patternHeadsignIdx = patternHeadsignIdx;
		this.tripOrder = Uint32Array.from(servedTrips.sort((a, b) => tripStart[a]! - tripStart[b]!));
	}

	get size(): number {
		return this.arrivalSecs.length;
	}

	tripOf(stopTimeIdx: number) {
		let low = 0;
		let high = this.tripOrder.length - 1;
		while (low < high) {
			const middle = (low + high + 1) >>> 1;
			if (this.tripStart[this.tripOrder[middle]!]! <= stopTimeIdx) low = middle;
			else high = middle - 1;
		}
		return this.tripOrder[low]!;
	}

	positionOf(stopTimeIdx: number, tripIdx = this.tripOf(stopTimeIdx)) {
		return this.patternStart[this.tripPattern[tripIdx]!]! + stopTimeIdx - this.tripStart[tripIdx]!;
	}

	getStopIndex(stopTimeIdx: number, tripIdx?: number) {
		return this.patternStopIdx[this.positionOf(stopTimeIdx, tripIdx)]!;
	}

	getStop(stopTimeIdx: number, tripIdx?: number) {
		return this.stopList[this.getStopIndex(stopTimeIdx, tripIdx)]!;
	}

	getStopHeadsign(stopTimeIdx: number, tripIdx?: number) {
		if (this.patternHeadsignIdx === undefined) return undefined;
		const headsignIndex = this.patternHeadsignIdx[this.positionOf(stopTimeIdx, tripIdx)];
		return headsignIndex ? this.headsignList[headsignIndex] : undefined;
	}

	getFlags(stopTimeIdx: number, tripIdx?: number) {
		return this.patternFlags[this.positionOf(stopTimeIdx, tripIdx)]!;
	}

	getSequence(stopTimeIdx: number, tripIdx?: number) {
		return this.patternSequence[this.positionOf(stopTimeIdx, tripIdx)]!;
	}

	getDistance(stopTimeIdx: number, tripIdx?: number) {
		return this.patternDistance[this.positionOf(stopTimeIdx, tripIdx)]!;
	}

	/** Arrêts desservis par au moins un stop_time, chacun une seule fois. */
	getServedStops() {
		const served = new Uint8Array(this.stopList.length);
		for (const index of this.patternStopIdx) served[index] = 1;
		return this.stopList.filter((_, index) => served[index] === 1);
	}
}

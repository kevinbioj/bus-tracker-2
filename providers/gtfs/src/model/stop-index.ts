import type { StopArea } from "./stop-area.js";
import type { StopTimeStore } from "./stop-time-store.js";
import type { Trip } from "./trip.js";

/**
 * Index inverse station → stop_times, en stockage columnar (CSR) comme {@link StopTimeStore} : le
 * GTFS n'est indexé que par course, et balayer toutes les courses d'un réseau pour répondre sur un
 * arrêt coûterait bien plus que les quatre octets par stop_time que cet index demande.
 *
 * Y figurent tous les stop_times, terminus et arrêts interdits à la montée ou à la descente compris :
 * c'est le sens du tableau demandé — départs ou arrivées — qui décide à la lecture lesquels écarter.
 */
export class StopIndex {
	constructor(
		/** Rang de chaque station dans {@link areaStart} / {@link areaCount}. */
		readonly areaSlots: Map<string, number>,
		readonly areaStart: Uint32Array,
		readonly areaCount: Uint32Array,
		/** Indices de stop_time, groupés par station et triés par heure de départ. */
		readonly stopTimeIdx: Uint32Array,
		readonly tripStart: Uint32Array,
		readonly tripOrder: Uint32Array,
	) {}

	rangeOf(areaId: string) {
		const slot = this.areaSlots.get(areaId);
		if (slot === undefined) return undefined;
		const start = this.areaStart[slot]!;
		return { start, end: start + this.areaCount[slot]! };
	}

	stopTimeAt(position: number) {
		return this.stopTimeIdx[position]!;
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

	*entriesOf(areaId: string): Generator<[number, number]> {
		const range = this.rangeOf(areaId);
		if (range === undefined) return;

		for (let position = range.start; position < range.end; position += 1) {
			const stopTimeIdx = this.stopTimeAt(position);
			yield [stopTimeIdx, this.tripOf(stopTimeIdx)];
		}
	}
}

/**
 * Construit l'index inverse. Les courses tombées à l'import (moins de deux arrêts) laissent leurs
 * stop_times dans le store sans plus figurer parmi les courses : elles sont écartées ici.
 */
export function buildStopIndex(
	stopTimeStore: StopTimeStore,
	trips: Iterable<Trip>,
	stopAreaByStopId: Map<string, string>,
): StopIndex {
	const { stopList, stopIdx, departureSecs, tripStart, tripCount } = stopTimeStore;

	const tripOfStopTime = new Int32Array(stopTimeStore.size).fill(-1);
	const servedTrips: number[] = [];
	for (const trip of trips) {
		const start = tripStart[trip.idx]!;
		const end = start + tripCount[trip.idx]!;
		if (end > start) servedTrips.push(trip.idx);
		for (let index = start; index < end; index += 1) {
			tripOfStopTime[index] = trip.idx;
		}
	}

	const areaSlots = new Map<string, number>();
	const counts: number[] = [];

	// Station de chaque arrêt, résolue une fois par arrêt plutôt qu'à chacun de ses stop_times.
	const UNRESOLVED = -2;
	const NO_AREA = -1;
	const slotOfStop = new Int32Array(stopList.length).fill(UNRESOLVED);
	const slotOfStopTime = new Int32Array(stopTimeStore.size).fill(NO_AREA);

	for (let index = 0; index < stopTimeStore.size; index += 1) {
		if (tripOfStopTime[index] === -1) continue;

		const stopIndex = stopIdx[index]!;
		let slot = slotOfStop[stopIndex]!;
		if (slot === UNRESOLVED) {
			const areaId = stopAreaByStopId.get(stopList[stopIndex]!.id);
			if (areaId === undefined) {
				slot = NO_AREA;
			} else {
				slot = areaSlots.get(areaId) ?? counts.length;
				if (slot === counts.length) {
					areaSlots.set(areaId, slot);
					counts.push(0);
				}
			}
			slotOfStop[stopIndex] = slot;
		}
		if (slot === NO_AREA) continue;

		slotOfStopTime[index] = slot;
		counts[slot] = counts[slot]! + 1;
	}

	const areaStart = new Uint32Array(counts.length);
	const areaCount = Uint32Array.from(counts);
	let offset = 0;
	for (let slot = 0; slot < counts.length; slot += 1) {
		areaStart[slot] = offset;
		offset += counts[slot]!;
	}

	const stopTimeIdx = new Uint32Array(offset);
	const writeCursor = Uint32Array.from(areaStart);

	for (let index = 0; index < stopTimeStore.size; index += 1) {
		const slot = slotOfStopTime[index]!;
		if (slot === NO_AREA) continue;

		const cursor = writeCursor[slot]!;
		stopTimeIdx[cursor] = index;
		writeCursor[slot] = cursor + 1;
	}

	// Tri par heure de départ à l'intérieur de chaque station : la recherche des prochains passages
	// peut ainsi s'arrêter dès qu'elle dépasse la fenêtre demandée.
	for (let slot = 0; slot < counts.length; slot += 1) {
		const start = areaStart[slot]!;
		const count = areaCount[slot]!;
		if (count < 2) continue;

		const order = Array.from({ length: count }, (_, offset) => start + offset).sort(
			(a, b) => departureSecs[stopTimeIdx[a]!]! - departureSecs[stopTimeIdx[b]!]!,
		);

		const sortedStopTimes = order.map((index) => stopTimeIdx[index]!);
		for (let offset = 0; offset < count; offset += 1) {
			stopTimeIdx[start + offset] = sortedStopTimes[offset]!;
		}
	}

	const tripOrder = Uint32Array.from(servedTrips.sort((a, b) => tripStart[a]! - tripStart[b]!));

	return new StopIndex(areaSlots, areaStart, areaCount, stopTimeIdx, tripStart, tripOrder);
}

/**
 * Stations réellement desservies, au départ ou à l'arrivée : celles que l'index connaît. C'est à la
 * publication de décider si une station sans départ mérite d'être montrée.
 */
export function filterServedStopAreas(stopAreas: Map<string, StopArea>, stopIndex: StopIndex) {
	const served = new Map<string, StopArea>();
	for (const [id, stopArea] of stopAreas) {
		if (stopIndex.areaSlots.has(id)) served.set(id, stopArea);
	}
	return served;
}

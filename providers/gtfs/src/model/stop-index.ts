import type { StopArea } from "./stop-area.js";
import type { StopTimeStore } from "./stop-time-store.js";
import type { Trip } from "./trip.js";

/** Bit de `StopTimeStore.flagsBitmask` marquant un arrêt où la montée est interdite. */
const NO_PICKUP_FLAG = 1;

/**
 * Index inverse station → stop_times, en stockage columnar (CSR) comme {@link StopTimeStore} : le
 * GTFS n'est indexé que par course, et balayer toutes les courses d'un réseau pour répondre sur un
 * arrêt coûterait bien plus que les huit octets par stop_time que cet index demande.
 *
 * N'y figurent que les stop_times d'où l'on peut effectivement partir : ni le terminus, qui n'a pas
 * de départ, ni les arrêts interdits à la montée.
 */
export class StopIndex {
	constructor(
		/** Rang de chaque station dans {@link areaStart} / {@link areaCount}. */
		readonly areaSlots: Map<string, number>,
		readonly areaStart: Uint32Array,
		readonly areaCount: Uint32Array,
		/** Indices de stop_time, groupés par station et triés par heure de départ. */
		readonly stopTimeIdx: Uint32Array,
		/** Course porteuse de chaque entrée, à l'index correspondant de {@link stopTimeIdx}. */
		readonly tripIdx: Uint32Array,
	) {}

	/** Entrées de la station, sous la forme de couples `[stopTimeIdx, tripIdx]`. Vide si inconnue. */
	*entriesOf(areaId: string): Generator<[number, number]> {
		const slot = this.areaSlots.get(areaId);
		if (slot === undefined) return;

		const start = this.areaStart[slot]!;
		const end = start + this.areaCount[slot]!;
		for (let index = start; index < end; index += 1) {
			yield [this.stopTimeIdx[index]!, this.tripIdx[index]!];
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
	const { stops, flagsBitmask, departureSecs, tripStart, tripCount } = stopTimeStore;

	const tripOfStopTime = new Int32Array(stopTimeStore.size).fill(-1);
	for (const trip of trips) {
		const start = tripStart[trip.idx]!;
		const end = start + tripCount[trip.idx]!;
		for (let index = start; index < end - 1; index += 1) {
			// La dernière desserte de la course est exclue : un terminus n'a pas de départ.
			tripOfStopTime[index] = trip.idx;
		}
	}

	const areaSlots = new Map<string, number>();
	const counts: number[] = [];

	const areaOfStopTime = new Array<string | undefined>(stopTimeStore.size);

	for (let index = 0; index < stopTimeStore.size; index += 1) {
		if (tripOfStopTime[index] === -1) continue;
		if ((flagsBitmask[index]! & NO_PICKUP_FLAG) !== 0) continue;

		const areaId = stopAreaByStopId.get(stops[index]!.id);
		if (areaId === undefined) continue;

		areaOfStopTime[index] = areaId;

		let slot = areaSlots.get(areaId);
		if (slot === undefined) {
			slot = counts.length;
			areaSlots.set(areaId, slot);
			counts.push(0);
		}
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
	const tripIdx = new Uint32Array(offset);
	const writeCursor = Uint32Array.from(areaStart);

	for (let index = 0; index < stopTimeStore.size; index += 1) {
		const areaId = areaOfStopTime[index];
		if (areaId === undefined) continue;

		const slot = areaSlots.get(areaId)!;
		const cursor = writeCursor[slot]!;
		stopTimeIdx[cursor] = index;
		tripIdx[cursor] = tripOfStopTime[index]!;
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
		const sortedTrips = order.map((index) => tripIdx[index]!);
		for (let offset = 0; offset < count; offset += 1) {
			stopTimeIdx[start + offset] = sortedStopTimes[offset]!;
			tripIdx[start + offset] = sortedTrips[offset]!;
		}
	}

	return new StopIndex(areaSlots, areaStart, areaCount, stopTimeIdx, tripIdx);
}

/** Stations réellement desservies : celles que l'index connaît. */
export function filterServedStopAreas(stopAreas: Map<string, StopArea>, stopIndex: StopIndex) {
	const served = new Map<string, StopArea>();
	for (const [id, stopArea] of stopAreas) {
		if (stopIndex.areaSlots.has(id)) served.set(id, stopArea);
	}
	return served;
}

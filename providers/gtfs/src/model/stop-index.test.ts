import { describe, expect, it } from "vitest";

import { indexStopAreas } from "../import/import-gtfs.js";
import { Agency } from "./agency.js";
import { Route } from "./route.js";
import { Service } from "./service.js";
import { Stop } from "./stop.js";
import { StopTimeStore } from "./stop-time-store.js";
import { Trip } from "./trip.js";

function makeNetwork() {
	const agency = new Agency("agency", "Agency", "UTC");
	const route = new Route("line:1", agency, "1", "BUS");
	const service = new Service("service", [true, true, true, true, true, true, true]);
	const a = new Stop("a", "A", 0, 0);
	const b = new Stop("b", "B", 0, 0.01);
	const c = new Stop("c", "C", 0, 0.02);
	const stops = [a, b, c, b, a, c, b];
	const secs = Uint32Array.from(stops, (_, index) => 8 * 3600 + ((index * 7) % 5) * 600);
	const store = StopTimeStore.fromStops(
		stops,
		new Uint8Array([1, 2, 3, 1, 2, 1, 2]),
		new Uint8Array(stops.length),
		secs,
		secs,
		new Float32Array(stops.length),
		new Uint32Array([0, 3, 3, 5]),
		new Uint32Array([3, 0, 2, 2]),
		new Uint32Array(4),
		new Uint32Array(4),
		new Uint32Array(4),
	);
	const makeTrip = (idx: number, id: string) => new Trip(idx, id, route, service, store, 0);
	const [tripA, tripB, tripC, tripD] = [makeTrip(0, "A"), makeTrip(1, "B"), makeTrip(2, "C"), makeTrip(3, "D")];
	return { store, trips: [tripD, tripA, tripB, tripC], tripA, tripC, tripD };
}

describe("StopIndex#tripOf", () => {
	it("retrouve la course de chaque stop_time, course vide et courses dans le désordre comprises", () => {
		const { store, trips, tripA, tripC, tripD } = makeNetwork();
		const { stopIndex } = indexStopAreas(store, trips);

		expect([0, 1, 2].map((index) => stopIndex.tripOf(index))).toEqual([tripA.idx, tripA.idx, tripA.idx]);
		expect([3, 4].map((index) => stopIndex.tripOf(index))).toEqual([tripC.idx, tripC.idx]);
		expect([5, 6].map((index) => stopIndex.tripOf(index))).toEqual([tripD.idx, tripD.idx]);
	});

	it("restitue pour chaque station la course de chacune de ses entrées", () => {
		const { store, trips } = makeNetwork();
		const { stopIndex } = indexStopAreas(store, trips);
		const tripOfStopTime = [0, 0, 0, 2, 2, 3, 3];

		for (const areaId of ["a", "b", "c"]) {
			const entries = [...stopIndex.entriesOf(areaId)];
			expect(entries.length).toBeGreaterThan(0);
			for (const [stopTimeIdx, tripIdx] of entries) {
				expect(tripIdx).toBe(tripOfStopTime[stopTimeIdx]);
			}
		}
	});
});

import { describe, expect, it } from "vitest";

import { Agency } from "../model/agency.js";
import { Route } from "../model/route.js";
import { Service } from "../model/service.js";
import { Stop } from "../model/stop.js";
import { StopTimeStore } from "../model/stop-time-store.js";
import { Trip } from "../model/trip.js";

import { indexStopAreas } from "./import-gtfs.js";

function makeTrip() {
	const agency = new Agency("agency", "Agency", "UTC");
	const route = new Route("line:1", agency, "1", "BUS");
	const service = new Service("service", [true, true, true, true, true, true, true]);
	const stops = [new Stop("a", "A", 0, 0), new Stop("b", "B", 0, 0.01)];
	const store = new StopTimeStore(
		stops,
		new Uint8Array([1, 2]),
		new Uint8Array([0, 0]),
		new Uint32Array([8 * 3600, 8 * 3600 + 600]),
		new Uint32Array([8 * 3600, 8 * 3600 + 600]),
		new Float32Array([0, 1000]),
		new Uint32Array([0]),
		new Uint32Array([2]),
		new Uint32Array([8 * 3600]),
		new Uint32Array([8 * 3600 + 600]),
		new Uint32Array([8 * 3600 + 600]),
	);
	return { store, trip: new Trip(0, "trip", route, service, store, 0, "B") };
}

describe("indexStopAreas", () => {
	it("parcourt deux fois un itérable à usage unique", () => {
		const { store, trip } = makeTrip();

		// `trips.values()` ne se parcourt qu'une fois : l'index et le tableau par idx sont tous deux
		// construits à partir de l'itérable, et l'un des deux repartirait à vide.
		const { stopAreas, stopIndex, tripsByIdx } = indexStopAreas(store, new Map([[trip.id, trip]]).values());

		expect([...stopAreas.keys()]).toEqual(["a"]);
		expect([...stopIndex.entriesOf("a")]).toEqual([[0, 0]]);
		expect(tripsByIdx[0]).toBe(trip);
	});
});

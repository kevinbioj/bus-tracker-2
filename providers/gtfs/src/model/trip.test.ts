import { describe, expect, it } from "vitest";

import { Agency } from "./agency.js";
import { Route } from "./route.js";
import { Service } from "./service.js";
import { Stop } from "./stop.js";
import { StopTimeStore } from "./stop-time-store.js";
import { Trip } from "./trip.js";

const DATE = Temporal.PlainDate.from("2026-06-01");

/**
 * Course transfrontalière d'une agence déclarée en `Europe/Paris` : deux arrêts français, puis un
 * arrêt portugais qui porte son propre fuseau (une heure de moins).
 *
 * A (Paris, 8:00) ── B (Paris, 9:00) ── C (Lisbonne, 10:00)
 */
function makeCrossBorderTrip() {
	const agency = new Agency("agency", "Agency", "Europe/Paris");
	const route = new Route("route", agency, "1", "COACH");
	const service = new Service("service");
	const stops = [
		new Stop("A", "A", 0, 0),
		new Stop("B", "B", 0, 0.01),
		new Stop("C", "C", 0, 0.02, undefined, "Europe/Lisbon"),
	];
	const store = new StopTimeStore(
		stops,
		new Uint8Array([1, 2, 3]),
		new Uint8Array([0, 0, 0]),
		new Uint32Array([8 * 3600, 9 * 3600, 10 * 3600]),
		new Uint32Array([8 * 3600, 9 * 3600, 10 * 3600]),
		new Float32Array([0, 1000, 2000]),
		new Uint32Array([0]),
		new Uint32Array([3]),
		new Uint32Array([8 * 3600]),
		new Uint32Array([10 * 3600]),
		new Uint32Array([10 * 3600]),
	);

	return new Trip(0, "trip", route, service, store, 0);
}

describe("Trip", () => {
	it("interprète les heures dans le fuseau de l'agence, y compris pour un arrêt d'un autre fuseau", () => {
		const calls = makeCrossBorderTrip().computeCallsForDate(DATE);

		// En juin, Europe/Paris = UTC+2. `stop_timezone` ne décale pas l'instant : l'arrêt de
		// Lisbonne est bien atteint à 10:00 heure de Paris, soit 09:00 heure locale portugaise.
		expect(new Date(calls[0]!.aimedArrivalTime).toISOString()).toBe("2026-06-01T06:00:00.000Z");
		expect(new Date(calls[1]!.aimedArrivalTime).toISOString()).toBe("2026-06-01T07:00:00.000Z");
		expect(new Date(calls[2]!.aimedArrivalTime).toISOString()).toBe("2026-06-01T08:00:00.000Z");
	});

	it("borne la course sur les mêmes instants que ses arrêts", () => {
		const trip = makeCrossBorderTrip();
		const journey = trip.getScheduledJourney(DATE, true);

		expect(journey.firstCallArrivalMs).toBe(trip.computeCallsForDate(DATE)[0]!.aimedArrivalTime);
		expect(journey.lastCallDepartureMs).toBe(trip.computeCallsForDate(DATE)[2]!.aimedDepartureTime);
	});
});

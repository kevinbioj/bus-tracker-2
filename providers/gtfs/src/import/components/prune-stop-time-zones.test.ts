import { describe, expect, it } from "vitest";

import { Agency } from "../../model/agency.js";
import { Stop } from "../../model/stop.js";

import { pruneStopTimeZones } from "./prune-stop-time-zones.js";

function makeStops() {
	return new Map(
		[
			new Stop("paris", "Paris", 48.8, 2.3, undefined, "Europe/Paris"),
			new Stop("madrid", "Madrid", 40.4, -3.7, undefined, "Europe/Madrid"),
			new Stop("lyon", "Lyon", 45.7, 4.8),
		].map((stop) => [stop.id, stop]),
	);
}

function makeAgencies(...timeZones: string[]) {
	return new Map(timeZones.map((timeZone, index) => [`${index}`, new Agency(`${index}`, `Agency ${index}`, timeZone)]));
}

describe("pruneStopTimeZones", () => {
	it("écarte le fuseau des arrêts identiques à l'unique fuseau des agences", () => {
		const stops = makeStops();

		pruneStopTimeZones(stops, makeAgencies("Europe/Paris", "Europe/Paris"));

		expect(stops.get("paris")!.timeZone).toBeUndefined();
		expect(stops.get("madrid")!.timeZone).toBe("Europe/Madrid");
		expect(stops.get("lyon")!.timeZone).toBeUndefined();
	});

	it("conserve tous les fuseaux lorsque les agences n'en partagent pas un seul", () => {
		const stops = makeStops();

		pruneStopTimeZones(stops, makeAgencies("Europe/Paris", "Europe/Madrid"));

		expect(stops.get("paris")!.timeZone).toBe("Europe/Paris");
		expect(stops.get("madrid")!.timeZone).toBe("Europe/Madrid");
	});

	it("ne fait rien sans agence", () => {
		const stops = makeStops();

		pruneStopTimeZones(stops, makeAgencies());

		expect(stops.get("paris")!.timeZone).toBe("Europe/Paris");
	});
});

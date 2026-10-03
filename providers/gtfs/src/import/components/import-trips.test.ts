import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { Agency } from "../../model/agency.js";
import { Route } from "../../model/route.js";
import { Service } from "../../model/service.js";
import { Shape } from "../../model/shape.js";
import { Stop } from "../../model/stop.js";

import { importTrips } from "./import-trips.js";

async function writeGtfs(files: Record<string, string[]>) {
	const directory = await mkdtemp(join(tmpdir(), "gtfs-trips-"));
	for (const [name, lines] of Object.entries(files)) {
		await writeFile(join(directory, name), lines.join("\n"));
	}
	return directory;
}

function makeResources() {
	const agency = new Agency("agency", "Agency", "UTC");
	const route = new Route("line", agency, "1", "BUS");
	const stops = new Map(
		[
			new Stop("a", "A", 0, 0),
			new Stop("b", "B", 0, 0.01),
			new Stop("c", "C", 0, 0.02),
			new Stop("unused", "U", 1, 1),
		].map((stop) => [stop.id, stop]),
	);
	// Tracé rectiligne le long de l'équateur, sans distances curvilignes exploitables : 0, 1 000, 2 000.
	const shape = new Shape("shape", new Float64Array([0, 0, 0, 0, 0.01, 1000, 0, 0.02, 2000]));
	return {
		routes: new Map([[route.id, route]]),
		services: new Map([["service", new Service("service")]]),
		shapes: new Map([[shape.id, shape]]),
		stops,
	};
}

const TRIPS = ["route_id,service_id,trip_id,shape_id", "line,service,t1,shape", "line,service,t2,shape"];

describe("importTrips", () => {
	it("range les stop_times par séquence et y retrouve leurs arrêts et girouettes", async () => {
		const directory = await writeGtfs({
			"trips.txt": TRIPS,
			"stop_times.txt": [
				"trip_id,arrival_time,departure_time,stop_id,stop_sequence,stop_headsign",
				// Désordonnée : le tri doit emporter arrêt et girouette avec la séquence.
				"t1,08:10:00,08:10:00,b,2,Vers C",
				"t1,08:00:00,08:00:00,a,1,Vers C",
				"t1,08:20:00,08:20:00,c,3,",
				"t2,09:00:00,09:00:00,c,1,",
				"t2,09:10:00,09:12:00,a,2,Retour",
			],
		});
		const { routes, services, shapes, stops } = makeResources();

		const { trips, stopTimeStore } = await importTrips(directory, {}, routes, services, shapes, stops);

		const t1 = trips.get("t1")!;
		const ids = (start: number, count: number) =>
			Array.from({ length: count }, (_, i) => stopTimeStore.getStop(start + i).id);
		const headsigns = (start: number, count: number) =>
			Array.from({ length: count }, (_, i) => stopTimeStore.getStopHeadsign(start + i));

		expect(ids(t1.stopTimeStart, 3)).toEqual(["a", "b", "c"]);
		expect(headsigns(t1.stopTimeStart, 3)).toEqual(["Vers C", "Vers C", undefined]);
		expect(t1.computeCallsForDate(Temporal.PlainDate.from("2026-06-01")).map((call) => call.headsign)).toEqual([
			"Vers C",
			"Vers C",
			undefined,
		]);

		const t2 = trips.get("t2")!;
		expect(ids(t2.stopTimeStart, 2)).toEqual(["c", "a"]);
		expect(headsigns(t2.stopTimeStart, 2)).toEqual([undefined, "Retour"]);

		// Une girouette répétée n'est stockée qu'une fois.
		expect(stopTimeStore.headsignList.filter((headsign) => headsign === "Vers C")).toHaveLength(1);
		expect(
			stopTimeStore
				.getServedStops()
				.map(({ id }) => id)
				.sort(),
		).toEqual(["a", "b", "c"]);
	});

	it("n'alloue aucune girouette lorsque le fichier n'en porte pas", async () => {
		const directory = await writeGtfs({
			"trips.txt": TRIPS,
			"stop_times.txt": [
				"trip_id,arrival_time,departure_time,stop_id,stop_sequence",
				"t1,08:00:00,08:00:00,a,1",
				"t1,08:10:00,08:10:00,b,2",
			],
		});
		const { routes, services, shapes, stops } = makeResources();

		const { stopTimeStore } = await importTrips(directory, {}, routes, services, shapes, stops);

		expect(stopTimeStore.headsignIdx).toBeUndefined();
		expect(stopTimeStore.getStopHeadsign(0)).toBeUndefined();
	});

	it("projette les arrêts sur le tracé lorsque les distances sont recalculées", async () => {
		const directory = await writeGtfs({
			"trips.txt": TRIPS,
			"stop_times.txt": [
				"trip_id,arrival_time,departure_time,stop_id,stop_sequence,shape_dist_traveled",
				"t1,08:00:00,08:00:00,a,1,5",
				"t1,08:10:00,08:10:00,b,2,6",
				"t1,08:20:00,08:20:00,c,3,7",
				"t2,09:00:00,09:00:00,c,1,",
				"t2,09:10:00,09:10:00,a,2,",
			],
		});
		const { routes, services, shapes, stops } = makeResources();

		const { trips, stopTimeStore } = await importTrips(
			directory,
			{ computeShapeDistTraveled: "always" },
			routes,
			services,
			shapes,
			stops,
		);

		const distances = (tripId: string) => {
			const trip = trips.get(tripId)!;
			return Array.from(
				stopTimeStore.distanceTraveled.subarray(trip.stopTimeStart, trip.stopTimeStart + trip.stopTimeCount),
			);
		};
		expect(distances("t1")).toEqual([0, 1000, 2000]);
		// Mêmes arrêts sur le même tracé : la projection mémorisée pour t1 vaut pour t2.
		expect(distances("t2")).toEqual([2000, 0]);
	});
});

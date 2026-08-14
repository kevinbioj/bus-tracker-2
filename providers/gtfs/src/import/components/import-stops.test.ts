import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { importStops } from "./import-stops.js";

async function writeStopsFile(contents: string) {
	const directory = await mkdtemp(join(tmpdir(), "gtfs-stops-"));
	await writeFile(join(directory, "stops.txt"), contents);
	return directory;
}

describe("importStops", () => {
	it("lit stop_timezone et l'hérite de la station parente lorsqu'il est absent", async () => {
		// La station parente est déclarée *après* son enfant : l'héritage ne peut être résolu
		// qu'une fois le fichier entièrement lu.
		const directory = await writeStopsFile(
			[
				"stop_id,stop_name,stop_lat,stop_lon,location_type,parent_station,stop_timezone",
				"lisbon,Lisboa,38.7,-9.1,0,,Europe/Lisbon",
				"madrid-quay,Madrid Quai 1,40.4,-3.7,0,madrid-station,",
				"madrid-station,Madrid,40.4,-3.7,1,,Europe/Madrid",
				"paris,Paris,48.8,2.3,0,,",
			].join("\n"),
		);

		const stops = await importStops(directory, {});

		expect(stops.get("lisbon")!.timeZone).toBe("Europe/Lisbon");
		expect(stops.get("madrid-quay")!.timeZone).toBe("Europe/Madrid");
		expect(stops.get("paris")!.timeZone).toBeUndefined();
		// La station parente reste écartée du résultat en l'absence d'importAllStops.
		expect(stops.has("madrid-station")).toBe(false);
	});

	it("indexe les stations parentes sur leur identifiant brut, avant mapStopId", async () => {
		const directory = await writeStopsFile(
			[
				"stop_id,stop_name,stop_lat,stop_lon,location_type,parent_station,stop_timezone",
				"station,Madrid,40.4,-3.7,1,,Europe/Madrid",
				"quay,Madrid Quai 1,40.4,-3.7,0,station,",
			].join("\n"),
		);

		const stops = await importStops(directory, { mapStopId: (stopId) => `X-${stopId}` });

		expect(stops.get("X-quay")!.timeZone).toBe("Europe/Madrid");
	});
});

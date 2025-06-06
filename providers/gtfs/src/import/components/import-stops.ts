import { join } from "node:path";

import { Stop } from "../../model/stop.js";
import { type CsvRecord, readCsv } from "../../utils/csv-reader.js";

import type { ImportGtfsOptions } from "../import-gtfs.js";

type StopRecord = CsvRecord<"stop_id" | "stop_name" | "stop_lat" | "stop_lon", "location_type">;

export async function importStops(gtfsDirectory: string, { mapStopId }: ImportGtfsOptions) {
	const stops = new Map<string, Stop>();

	await readCsv<StopRecord>(join(gtfsDirectory, "stops.txt"), (stopRecord) => {
		if (
			typeof stopRecord.location_type !== "undefined" &&
			stopRecord.location_type !== "" &&
			stopRecord.location_type !== "0"
		) {
			return;
		}

		const stop = new Stop(
			mapStopId?.(stopRecord.stop_id) ?? stopRecord.stop_id,
			stopRecord.stop_name,
			+stopRecord.stop_lat,
			+stopRecord.stop_lon,
		);

		stops.set(stop.id, stop);
	});

	return stops;
}

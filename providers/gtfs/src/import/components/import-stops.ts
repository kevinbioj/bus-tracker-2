import { join } from "node:path";

import { Stop } from "../../model/stop.js";
import { type CsvRecord, readCsv } from "../../utils/csv-reader.js";

import type { ImportGtfsOptions } from "../import-gtfs.js";

type StopRecord = CsvRecord<
	"stop_id" | "stop_name" | "stop_lat" | "stop_lon",
	"location_type" | "platform_code" | "stop_timezone" | "parent_station"
>;

export async function importStops(gtfsDirectory: string, { importAllStops, mapStopId }: ImportGtfsOptions) {
	const stops = new Map<string, Stop>();

	// Les chaînes de fuseau sont internées : des milliers d'arrêts d'un même pays partagent
	// ainsi une seule instance au lieu d'une copie par ligne CSV.
	const timeZones = new Map<string, string>();
	const internTimeZone = (timeZone: string) => {
		const interned = timeZones.get(timeZone);
		if (interned !== undefined) return interned;
		timeZones.set(timeZone, timeZone);
		return timeZone;
	};

	// Indexées par identifiant *brut* : `parent_station` référence les identifiants d'origine,
	// avant application de `mapStopId`.
	const stationTimeZones = new Map<string, string>();
	// La station parente peut apparaître après ses enfants : l'héritage est résolu après la passe.
	const pendingInheritance: { stop: Stop; parentId: string }[] = [];

	await readCsv<StopRecord>(join(gtfsDirectory, "stops.txt"), (stopRecord) => {
		const timeZone = stopRecord.stop_timezone ? internTimeZone(stopRecord.stop_timezone) : undefined;

		// Les stations (location_type = 1) sont enregistrées même lorsqu'elles sont écartées
		// du résultat, car leurs enfants peuvent hériter de leur fuseau.
		if (timeZone !== undefined) {
			stationTimeZones.set(stopRecord.stop_id, timeZone);
		}

		if (
			!importAllStops &&
			stopRecord.location_type !== undefined &&
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
			stopRecord.platform_code || undefined,
			timeZone,
		);

		if (timeZone === undefined && stopRecord.parent_station) {
			pendingInheritance.push({ stop, parentId: stopRecord.parent_station });
		}

		stops.set(stop.id, stop);
	});

	for (const { stop, parentId } of pendingInheritance) {
		stop.timeZone = stationTimeZones.get(parentId);
	}

	return stops;
}

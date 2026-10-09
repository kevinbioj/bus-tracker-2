import type { Gtfs } from "../model/gtfs.js";
import type { Source } from "../model/source.js";

const staticStopAreaIds = new WeakMap<Gtfs, Map<string, string>>();

export function getStopAreaId(source: Source, gtfs: Gtfs, stopId: string) {
	for (const stopArea of source.realtimeStopAreas.values()) {
		if (stopArea.stops.some(({ id }) => id === stopId)) return stopArea.id;
	}

	let stopAreaIds = staticStopAreaIds.get(gtfs);
	if (stopAreaIds === undefined) {
		stopAreaIds = new Map(
			gtfs.stopAreas.values().flatMap((stopArea) => stopArea.stops.map(({ id }) => [id, stopArea.id] as const)),
		);
		staticStopAreaIds.set(gtfs, stopAreaIds);
	}
	return stopAreaIds.get(stopId);
}

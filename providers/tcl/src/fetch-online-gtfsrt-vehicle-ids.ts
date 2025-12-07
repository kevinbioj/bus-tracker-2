import type { TclGtfsRt } from "./types.js";

export async function fetchOnlineGtfsrtVehicleIds() {
	const response = await fetch("https://gtfs.bus-tracker.fr/gtfs-rt/tcl/?format=json");
	if (!response.ok) {
		return [];
	}

	const payload = (await response.json()) as TclGtfsRt;
	return payload.entity
		.filter(
			(entity) =>
				typeof entity.vehicle !== "undefined" && Math.floor(Date.now() / 1000) - entity.vehicle.timestamp < 600,
		)
		.map((entity) => +entity.vehicle!.vehicle.id);
}

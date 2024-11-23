import { Buffer } from "node:buffer";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";

import type { GtfsRt, TripUpdate, VehiclePosition } from "../model/gtfs-rt.js";

const feedMessage = GtfsRealtimeBindings.transit_realtime.FeedMessage;

export async function downloadGtfsRt(
	realtimeFeedHrefs: string[],
	mapTripUpdate?: (tripUpdate: TripUpdate) => TripUpdate | undefined,
	mapVehiclePosition?: (vehicle: VehiclePosition) => VehiclePosition | undefined,
) {
	const tripUpdates: TripUpdate[] = [];
	const vehiclePositions: VehiclePosition[] = [];

	await Promise.allSettled(
		realtimeFeedHrefs.map(async (realtimeFeedHref) => {
			const response = await fetch(realtimeFeedHref, {
				signal: AbortSignal.timeout(5_000),
			});

			if (!response.ok)
				throw new Error(`Failed to download feed at '${realtimeFeedHref}' (status ${response.status}).`);

			if (response.status === 204) return;

			const buffer = Buffer.from(await response.arrayBuffer());
			const gtfsRt = feedMessage.toObject(feedMessage.decode(buffer), {
				enums: String,
				longs: Number,
			}) as GtfsRt;
			const entities = gtfsRt.entity ?? [];

			for (const entity of entities) {
				if (entity.tripUpdate) {
					const tripUpdate = typeof mapTripUpdate === "function" ? mapTripUpdate(entity.tripUpdate) : entity.tripUpdate;
					if (typeof tripUpdate === "undefined") continue;
					tripUpdate.timestamp ||= gtfsRt.header.timestamp;
					tripUpdates.push(tripUpdate);
				}

				if (entity.vehicle) {
					const vehiclePosition =
						typeof mapVehiclePosition === "function" ? mapVehiclePosition(entity.vehicle) : entity.vehicle;
					if (typeof vehiclePosition === "undefined") continue;
					vehiclePosition.timestamp ||= gtfsRt.header.timestamp;
					vehiclePositions.push(vehiclePosition);
				}
			}
		}),
	);

	return { tripUpdates, vehiclePositions };
}

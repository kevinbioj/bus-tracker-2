import { Buffer } from "node:buffer";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";

import type { GtfsRtEntity, TripUpdate, VehiclePosition } from "../model/gtfs-rt.js";

const feedMessage = GtfsRealtimeBindings.transit_realtime.FeedMessage;

export async function downloadGtfsRt(
	realtimeFeedHrefs: string[],
	mapTripUpdate?: (tripUpdate: TripUpdate) => TripUpdate,
	mapVehiclePosition?: (vehicle: VehiclePosition) => VehiclePosition,
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
			const entities: GtfsRtEntity[] =
				feedMessage.toObject(feedMessage.decode(buffer), {
					enums: String,
					longs: Number,
				})?.entity ?? [];

			for (const entity of entities) {
				if (entity.tripUpdate) {
					tripUpdates.push(typeof mapTripUpdate === "function" ? mapTripUpdate(entity.tripUpdate) : entity.tripUpdate);
				}

				if (entity.vehicle) {
					vehiclePositions.push(
						typeof mapVehiclePosition === "function" ? mapVehiclePosition(entity.vehicle) : entity.vehicle,
					);
				}
			}
		}),
	);

	return { tripUpdates, vehiclePositions };
}

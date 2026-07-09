import { Buffer } from "node:buffer";
import { captureException } from "@bus-tracker/monitoring";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";

import { USER_AGENT } from "../constants.js";
import type { GtfsRt, TripUpdate, VehiclePosition } from "../model/gtfs-rt.js";
import type { Source } from "../model/source.js";
import { getAuthHeaders } from "../utils/auth.js";

const feedMessage = GtfsRealtimeBindings.transit_realtime.FeedMessage;

export async function downloadGtfsRt(source: Source) {
	const realtimeResources = (source.options.realtimeResourceHrefs ?? []).map((resource) =>
		typeof resource === "string" ? { href: resource } : resource,
	);

	const tripUpdates: TripUpdate[] = [];
	const vehiclePositions: VehiclePosition[] = [];

	await Promise.allSettled(
		realtimeResources.map(async ({ href: realtimeFeedHref, pollMs }) => {
			const cached = source.realtimeFeedCache.get(realtimeFeedHref);

			// Réutilise la donnée en cache tant qu'elle est plus fraîche que l'intervalle de polling.
			if (pollMs !== undefined && cached !== undefined && Date.now() - cached.at < pollMs) {
				tripUpdates.push(...cached.tripUpdates);
				vehiclePositions.push(...cached.vehiclePositions);
				return;
			}

			try {
				const response = await fetch(realtimeFeedHref, {
					headers: {
						"User-Agent": USER_AGENT,
						...getAuthHeaders(source.options.realtimeAuth ?? source.options.auth),
					},
					signal: AbortSignal.timeout(15_000),
				});

				if ([204, 429].includes(response.status)) return;

				if (!response.ok)
					throw new Error(`Failed to download feed at '${realtimeFeedHref}' (status ${response.status}).`);

				const buffer = Buffer.from(await response.arrayBuffer());
				const gtfsRt = feedMessage.toObject(feedMessage.decode(buffer), {
					enums: String,
					longs: Number,
				}) as GtfsRt;
				const entities = gtfsRt.entity ?? [];

				const feedTripUpdates: TripUpdate[] = [];
				const feedVehiclePositions: VehiclePosition[] = [];

				for (const entity of entities) {
					if (entity.tripUpdate) {
						const tripUpdate =
							typeof source.options.mapTripUpdate === "function"
								? source.options.mapTripUpdate(entity.tripUpdate, source.gtfs!)
								: entity.tripUpdate;
						if (tripUpdate === undefined) continue;
						tripUpdate.timestamp ||= gtfsRt.header.timestamp;
						feedTripUpdates.push(tripUpdate);
					}

					if (entity.vehicle) {
						const vehiclePosition =
							typeof source.options.mapVehiclePosition === "function"
								? source.options.mapVehiclePosition(entity.vehicle, source.gtfs!)
								: entity.vehicle;
						if (vehiclePosition === undefined) continue;
						vehiclePosition.timestamp ||= gtfsRt.header.timestamp;
						feedVehiclePositions.push(vehiclePosition);
					}
				}

				if (pollMs !== undefined) {
					source.realtimeFeedCache.set(realtimeFeedHref, {
						at: Date.now(),
						tripUpdates: feedTripUpdates,
						vehiclePositions: feedVehiclePositions,
					});
				}

				tripUpdates.push(...feedTripUpdates);
				vehiclePositions.push(...feedVehiclePositions);
			} catch (cause) {
				// Sur un flux à polling, en cas d'échec on préfère servir la dernière donnée connue
				// plutôt que de perdre tous les véhicules du flux.
				if (pollMs !== undefined && cached !== undefined) {
					tripUpdates.push(...cached.tripUpdates);
					vehiclePositions.push(...cached.vehiclePositions);
				}

				console.error(new Error(`Failed to download entities at '${realtimeFeedHref}'`, { cause }));
				captureException(cause, {
					sourceId: source.id,
					realtimeFeedHref,
					$exception_fingerprint: [`gtfs-rt-error`, source.id, realtimeFeedHref],
				});
			}
		}),
	);

	return { tripUpdates, vehiclePositions };
}

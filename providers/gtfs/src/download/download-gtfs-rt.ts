import { Buffer } from "node:buffer";
import { captureException } from "@bus-tracker/monitoring";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";

import { USER_AGENT } from "../constants.js";
import type { GtfsRt, IdentifiedTripModifications, TripUpdate, VehiclePosition } from "../model/gtfs-rt.js";
import {
	createRealtimeResources,
	createShapeFromRtShape,
	createStopFromRtStop,
	type RealtimeResources,
} from "../model/realtime-lookup.js";
import type { RealtimeEntityType, Source } from "../model/source.js";
import { getAuthHeaders } from "../utils/auth.js";

const feedMessage = GtfsRealtimeBindings.transit_realtime.FeedMessage;

/** Ce qu'un flux a livré au cours d'un cycle, tel que mis en cache pour les flux à polling. */
export type RealtimeFeedContents = {
	tripUpdates: TripUpdate[];
	vehiclePositions: VehiclePosition[];
	tripModifications: IdentifiedTripModifications[];
	shapes: RealtimeResources["shapes"];
	stops: RealtimeResources["stops"];
};

/**
 * Mémorise ce qu'un flux publie réellement, pour l'exposer en attributions. Un producteur peut
 * annoncer un flux « trip-updates » qui porte aussi des positions : seul le contenu lu fait foi.
 * Les types observés sont cumulés, un cycle vide ne retire pas ce qui a déjà été vu.
 */
function recordObservedEntityTypes(source: Source, href: string, contents: RealtimeFeedContents) {
	const tripUpdateCount = contents.tripUpdates.length;
	const vehiclePositionCount = contents.vehiclePositions.length;
	const tripModificationCount = contents.tripModifications.length;

	if (tripUpdateCount === 0 && vehiclePositionCount === 0 && tripModificationCount === 0) return;

	let entityTypes = source.observedRealtimeEntityTypes.get(href);
	if (entityTypes === undefined) {
		entityTypes = new Set<RealtimeEntityType>();
		source.observedRealtimeEntityTypes.set(href, entityTypes);
	}

	if (tripUpdateCount > 0) entityTypes.add("TRIP_UPDATES");
	if (vehiclePositionCount > 0) entityTypes.add("VEHICLE_POSITIONS");
	if (tripModificationCount > 0) entityTypes.add("TRIP_MODIFICATIONS");
}

function createFeedContents(): RealtimeFeedContents {
	const { shapes, stops } = createRealtimeResources();
	return { tripUpdates: [], vehiclePositions: [], tripModifications: [], shapes, stops };
}

export async function downloadGtfsRt(source: Source) {
	const realtimeResources = (source.options.realtimeResourceHrefs ?? []).map((resource) =>
		typeof resource === "string" ? { href: resource } : resource,
	);

	const tripUpdates: TripUpdate[] = [];
	const vehiclePositions: VehiclePosition[] = [];
	const tripModifications: IdentifiedTripModifications[] = [];
	const resources = createRealtimeResources();
	/** Flux dont aucune donnée n'a pu être obtenue, cache de repli compris. */
	let failedFeedCount = 0;

	const collect = (contents: RealtimeFeedContents) => {
		tripUpdates.push(...contents.tripUpdates);
		vehiclePositions.push(...contents.vehiclePositions);
		tripModifications.push(...contents.tripModifications);
		for (const [id, shape] of contents.shapes) resources.shapes.set(id, shape);
		for (const [id, stop] of contents.stops) resources.stops.set(id, stop);
	};

	await Promise.allSettled(
		realtimeResources.map(async ({ href: realtimeFeedHref, pollMs }) => {
			const cached = source.realtimeFeedCache.get(realtimeFeedHref);

			// Réutilise la donnée en cache tant qu'elle est plus fraîche que l'intervalle de polling.
			if (pollMs !== undefined && cached !== undefined && Date.now() - cached.at < pollMs) {
				collect(cached.contents);
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

				// 204 : le producteur signale explicitement un flux vide, la donnée lue est à jour.
				if (response.status === 204) return;

				// 429 : rien n'a pu être lu, le flux est indisponible pour ce cycle.
				if (response.status === 429) {
					failedFeedCount += 1;
					return;
				}

				if (!response.ok)
					throw new Error(`Failed to download feed at '${realtimeFeedHref}' (status ${response.status}).`);

				const buffer = Buffer.from(await response.arrayBuffer());
				const gtfsRt = feedMessage.toObject(feedMessage.decode(buffer), {
					enums: String,
					longs: Number,
				}) as GtfsRt;
				const entities = gtfsRt.entity ?? [];

				const contents = createFeedContents();

				for (const entity of entities) {
					if (entity.tripUpdate) {
						const tripUpdate =
							typeof source.options.mapTripUpdate === "function"
								? source.options.mapTripUpdate(entity.tripUpdate, source.gtfs!)
								: entity.tripUpdate;
						if (tripUpdate === undefined) continue;
						tripUpdate.timestamp ||= gtfsRt.header.timestamp;
						contents.tripUpdates.push(tripUpdate);
					}

					if (entity.vehicle) {
						const vehiclePosition =
							typeof source.options.mapVehiclePosition === "function"
								? source.options.mapVehiclePosition(entity.vehicle, source.gtfs!)
								: entity.vehicle;
						if (vehiclePosition === undefined) continue;
						vehiclePosition.timestamp ||= gtfsRt.header.timestamp;
						contents.vehiclePositions.push(vehiclePosition);
					}

					if (entity.tripModifications) {
						const mapped =
							typeof source.options.mapTripModifications === "function"
								? source.options.mapTripModifications(entity.tripModifications, source.gtfs!)
								: entity.tripModifications;
						if (mapped === undefined) continue;
						// `modified_trip.modifications_id` désigne l'entité porteuse, pas la modification :
						// son identifiant doit voyager avec elle pour que les TripUpdate s'y rattachent.
						contents.tripModifications.push({ ...mapped, id: entity.id });
					}

					if (entity.shape) {
						const shape = createShapeFromRtShape(entity.shape);
						if (shape !== undefined) contents.shapes.set(shape.id, shape);
					}

					if (entity.stop) {
						const stop = createStopFromRtStop(entity.stop);
						if (stop !== undefined) contents.stops.set(stop.id, stop);
					}
				}

				recordObservedEntityTypes(source, realtimeFeedHref, contents);

				if (pollMs !== undefined) {
					source.realtimeFeedCache.set(realtimeFeedHref, { at: Date.now(), contents });
				}

				collect(contents);
			} catch (cause) {
				// Sur un flux à polling, en cas d'échec on préfère servir la dernière donnée connue
				// plutôt que de perdre tous les véhicules du flux.
				if (pollMs !== undefined && cached !== undefined) {
					collect(cached.contents);
				} else {
					failedFeedCount += 1;
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

	return { tripUpdates, vehiclePositions, tripModifications, resources, failedFeedCount };
}

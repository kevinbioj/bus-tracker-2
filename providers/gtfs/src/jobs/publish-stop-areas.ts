import {
	STOP_AREA_TTL_SECONDS,
	STOP_AREAS_GEO_KEY,
	STOP_AREAS_INVALIDATION_CHANNEL,
	type StopAreaManifest,
	stopAreaKey,
	stopAreasSourceKey,
	stopPointAreaKey,
	stopPointsSourceKey,
} from "@bus-tracker/contracts";
import { captureException } from "@bus-tracker/monitoring";
import type { createRedisClient } from "@bus-tracker/redis";

import type { Source } from "../model/source.js";
import { padSourceId } from "../utils/pad-source-id.js";
import { createTripNetworkResolver } from "../utils/trip-network-ref.js";

/** Taille des transactions d'écriture, pour ne pas bloquer Redis sur un réseau de plusieurs milliers de stations. */
const CHUNK_SIZE = 500;

type RedisClient = ReturnType<typeof createRedisClient>;

/** `GEOADD` refuse les latitudes au-delà de ±85,05° ; un arrêt en (0, 0) trahit des coordonnées absentes. */
const isIndexable = ({ latitude, longitude }: StopAreaManifest) =>
	Math.abs(latitude) <= 85.05 && Math.abs(longitude) <= 180 && (latitude !== 0 || longitude !== 0);

function buildStopAreaManifests(providerId: string, source: Source, updatedAt: string): StopAreaManifest[] {
	const gtfs = source.gtfs;
	if (gtfs === undefined) return [];

	const { mapLineRef, mapStopRef } = source.options;
	const networkOf = createTripNetworkResolver(source);
	const stopRefOf = (networkRef: string, stopId: string) => `${networkRef}:StopPoint:${mapStopRef?.(stopId) ?? stopId}`;

	// Réseaux et lignes de chaque station, relevés sur les courses qui la desservent : une source peut
	// alimenter plusieurs réseaux, et c'est la course, pas l'arrêt, qui en décide.
	const services = new Map<string, { courseCountByNetwork: Map<string, number>; lineRefs: Set<string> }>();
	const record = (areaId: string, networkRef: string, routeId: string) => {
		let service = services.get(areaId);
		if (service === undefined) {
			service = { courseCountByNetwork: new Map(), lineRefs: new Set() };
			services.set(areaId, service);
		}
		service.courseCountByNetwork.set(networkRef, (service.courseCountByNetwork.get(networkRef) ?? 0) + 1);
		service.lineRefs.add(`${networkRef}:Line:${mapLineRef?.(routeId) ?? routeId}`);
	};

	for (const stopArea of gtfs.stopAreas.values()) {
		for (const [, tripIdx] of gtfs.stopIndex.entriesOf(stopArea.id)) {
			const trip = gtfs.tripsByIdx[tripIdx];
			if (trip !== undefined) record(stopArea.id, networkOf(trip), trip.route.id);
		}
	}

	// Arrêts créés par le flux temps réel : seules les courses déviées les desservent.
	for (const journeyKey of source.modifiedJourneyKeys) {
		const journey = gtfs.journeys.get(journeyKey);
		if (journey === undefined) continue;
		for (const call of journey.calls) {
			if (source.realtimeStopAreas.has(call.stop.id)) {
				record(call.stop.id, networkOf(journey.trip, journey), journey.trip.route.id);
			}
		}
	}

	return [...gtfs.stopAreas.values(), ...source.realtimeStopAreas.values()].flatMap((stopArea) => {
		const service = services.get(stopArea.id);
		if (service === undefined) return [];

		// Le réseau qui dessert le plus la station devient son réseau principal.
		const networkRefs = [...service.courseCountByNetwork]
			.sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b))
			.map(([networkRef]) => networkRef);
		const networkRef = networkRefs[0]!;

		return [
			{
				ref: `${networkRef}:StopArea:${stopArea.id}`,
				name: stopArea.name,
				latitude: stopArea.latitude,
				longitude: stopArea.longitude,
				networkRef,
				networkRefs,
				stopRefs: networkRefs.flatMap((network) => stopArea.stops.map((stop) => stopRefOf(network, stop.id))),
				stopPoints: stopArea.stops.map((stop) => ({
					ref: stopRefOf(networkRef, stop.id),
					latitude: stop.latitude,
					longitude: stop.longitude,
					...(stop.platformCode !== undefined ? { platformCode: stop.platformCode } : {}),
				})),
				providerId,
				sourceId: source.id,
				lineRefs: [...service.lineRefs].sort(),
				updatedAt,
			},
		];
	});
}

/**
 * Publie l'inventaire des stations desservies dans Redis : une fiche par station, à durée de vie
 * limitée, et sa position dans l'index géographique commun. Les stations que la source ne publie plus
 * — un identifiant changé d'une révision GTFS à l'autre — sont retirées aussitôt.
 *
 * À rappeler plus souvent que la durée de vie des fiches, même sans changement de ressource : c'est
 * ce qui les maintient en vie, et laisse expirer celles d'un provider arrêté.
 */
export async function publishStopAreas(redis: RedisClient, providerId: string, sources: Source[]) {
	const updatedAt = Temporal.Now.instant().toString();

	for (const source of sources) {
		try {
			// Sans ressource chargée (import en échec), l'inventaire publié est laissé en l'état : le
			// vider effacerait la source de la carte le temps d'une erreur de téléchargement.
			if (source.gtfs === undefined) continue;

			// Un inventaire vide est publié comme les autres : les stations d'une source qui n'en produit
			// plus doivent disparaître, pas attendre leur expiration.
			const manifests = buildStopAreaManifests(providerId, source, updatedAt).filter(isIndexable);

			const areasKey = stopAreasSourceKey(providerId, source.id);
			const pointsKey = stopPointsSourceKey(providerId, source.id);

			const currentRefs = new Set(manifests.map(({ ref }) => ref));
			const currentStopRefs = new Set(manifests.flatMap(({ stopRefs }) => stopRefs));
			const [previousRefs, previousStopRefs] = await Promise.all([redis.sMembers(areasKey), redis.sMembers(pointsKey)]);
			const staleRefs = previousRefs.filter((ref) => !currentRefs.has(ref));
			// Un quai peut disparaître d'une station qui, elle, demeure : il est suivi à part.
			const staleStopRefs = previousStopRefs.filter((ref) => !currentStopRefs.has(ref));

			// Les éléments disparus sont retirés *avant* l'écriture des nouveaux : un quai passé d'une
			// station à une autre voit ainsi sa correspondance réécrite, et non effacée après coup.
			if (staleRefs.length > 0 || staleStopRefs.length > 0) {
				const transaction = redis.multi();
				if (staleRefs.length > 0) transaction.zRem(STOP_AREAS_GEO_KEY, staleRefs);
				transaction.del([...staleRefs.map(stopAreaKey), ...staleStopRefs.map(stopPointAreaKey)]);
				await transaction.exec();
			}

			for (let index = 0; index < manifests.length; index += CHUNK_SIZE) {
				const chunk = manifests.slice(index, index + CHUNK_SIZE);
				const transaction = redis.multi();
				for (const manifest of chunk) {
					transaction.set(stopAreaKey(manifest.ref), JSON.stringify(manifest), { EX: STOP_AREA_TTL_SECONDS });
					for (const stopRef of manifest.stopRefs) {
						transaction.set(stopPointAreaKey(stopRef), manifest.ref, { EX: STOP_AREA_TTL_SECONDS });
					}
				}
				transaction.geoAdd(
					STOP_AREAS_GEO_KEY,
					chunk.map(({ ref, latitude, longitude }) => ({ member: ref, latitude, longitude })),
				);
				await transaction.exec();
			}

			const transaction = redis.multi();
			transaction.del([areasKey, pointsKey]);
			if (currentRefs.size > 0) {
				transaction.sAdd(areasKey, [...currentRefs]);
				transaction.expire(areasKey, STOP_AREA_TTL_SECONDS);
			}
			if (currentStopRefs.size > 0) {
				transaction.sAdd(pointsKey, [...currentStopRefs]);
				transaction.expire(pointsKey, STOP_AREA_TTL_SECONDS);
			}
			await transaction.exec();

			// Le serveur garde stations et marqueurs en cache quelques minutes : il les oublie dès maintenant.
			await redis.publish(STOP_AREAS_INVALIDATION_CHANNEL, JSON.stringify({ providerId, sourceId: source.id }));

			console.log(
				"%s ✓ Published %d stop areas (%d areas and %d stop points removed).",
				padSourceId(source.id),
				manifests.length,
				staleRefs.length,
				staleStopRefs.length,
			);
		} catch (cause) {
			console.error(new Error(`Failed to publish stop areas for '${source.id}'.`, { cause }));
			captureException(cause);
		}
	}
}

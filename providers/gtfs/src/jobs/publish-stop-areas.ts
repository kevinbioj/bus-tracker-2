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
import type { StopArea } from "../model/stop-area.js";
import { padSourceId } from "../utils/pad-source-id.js";

import { resolveNetworkRefs } from "./publish-data-sources.js";

/** Taille des transactions d'écriture, pour ne pas bloquer Redis sur un réseau de plusieurs milliers de stations. */
const CHUNK_SIZE = 500;

type RedisClient = ReturnType<typeof createRedisClient>;

/** `GEOADD` refuse les latitudes au-delà de ±85,05° ; un arrêt en (0, 0) trahit des coordonnées absentes. */
const isIndexable = ({ latitude, longitude }: StopAreaManifest) =>
	Math.abs(latitude) <= 85.05 && Math.abs(longitude) <= 180 && (latitude !== 0 || longitude !== 0);

function buildStopAreaManifests(providerId: string, source: Source, updatedAt: string): StopAreaManifest[] {
	const gtfs = source.gtfs;
	if (gtfs === undefined) return [];

	const networkRefs = resolveNetworkRefs(source);
	// Une source qui alimente plusieurs réseaux ne permet pas de rattacher une station à l'un d'eux :
	// le réseau dépend de la course, pas de l'arrêt.
	if (networkRefs.length !== 1) return [];
	const networkRef = networkRefs[0]!;

	const { mapLineRef, mapStopRef } = source.options;
	const lineRefOf = (routeId: string) => `${networkRef}:Line:${mapLineRef?.(routeId) ?? routeId}`;

	// Lignes des arrêts créés par le flux temps réel : seules les courses déviées les desservent.
	const realtimeLineRefs = new Map<string, Set<string>>();
	for (const journeyKey of source.modifiedJourneyKeys) {
		const journey = gtfs.journeys.get(journeyKey);
		if (journey === undefined) continue;
		for (const call of journey.calls) {
			if (!source.realtimeStopAreas.has(call.stop.id)) continue;
			const lineRefs = realtimeLineRefs.get(call.stop.id) ?? new Set<string>();
			lineRefs.add(lineRefOf(journey.trip.route.id));
			realtimeLineRefs.set(call.stop.id, lineRefs);
		}
	}

	const lineRefsOf = (stopArea: StopArea) => {
		const realtime = realtimeLineRefs.get(stopArea.id);
		if (realtime !== undefined) return realtime;

		const lineRefs = new Set<string>();
		for (const [, tripIdx] of gtfs.stopIndex.entriesOf(stopArea.id)) {
			const route = gtfs.tripsByIdx[tripIdx]?.route;
			if (route !== undefined) lineRefs.add(lineRefOf(route.id));
		}
		return lineRefs;
	};

	return [...gtfs.stopAreas.values(), ...source.realtimeStopAreas.values()].map((stopArea) => ({
		ref: `${networkRef}:StopArea:${stopArea.id}`,
		name: stopArea.name,
		latitude: stopArea.latitude,
		longitude: stopArea.longitude,
		networkRef,
		stopRefs: stopArea.stops.map((stop) => `${networkRef}:StopPoint:${mapStopRef?.(stop.id) ?? stop.id}`),
		stopPoints: stopArea.stops.map((stop) => ({
			ref: `${networkRef}:StopPoint:${mapStopRef?.(stop.id) ?? stop.id}`,
			latitude: stop.latitude,
			longitude: stop.longitude,
			...(stop.platformCode !== undefined ? { platformCode: stop.platformCode } : {}),
		})),
		providerId,
		sourceId: source.id,
		lineRefs: [...lineRefsOf(stopArea)].sort(),
		updatedAt,
	}));
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

import {
	STOP_AREA_TTL_SECONDS,
	STOP_AREAS_GEO_KEY,
	STOP_AREAS_INVALIDATION_CHANNEL,
	type StopAreaManifest,
	type StopAreaMode,
	type StopPoint,
	stopAreaKey,
	stopAreaModes,
	stopAreasSourceKey,
	stopPointAreaKey,
	stopPointsSourceKey,
} from "@bus-tracker/contracts";
import { captureException } from "@bus-tracker/monitoring";
import type { createRedisClient } from "@bus-tracker/redis";

import type { Route, RouteType } from "../model/route.js";
import type { Source } from "../model/source.js";
import type { Stop } from "../model/stop.js";
import { padSourceId } from "../utils/pad-source-id.js";
import { createTripNetworkResolver } from "../utils/trip-network-ref.js";

/** Bit de `StopTimeStore.flagsBitmask` marquant un arrêt où la montée est interdite. */
const NO_PICKUP_FLAG = 1;

/** Taille des transactions d'écriture, pour ne pas bloquer Redis sur un réseau de plusieurs milliers de stations. */
const CHUNK_SIZE = 500;

type RedisClient = ReturnType<typeof createRedisClient>;

/** Mode d'une station pour un type de route : hors des modes retenus, un bus. */
const modeOf = (routeType: RouteType): StopAreaMode =>
	(stopAreaModes as readonly string[]).includes(routeType) ? (routeType as StopAreaMode) : "BUS";

/** Le plus lourd de deux modes, dans l'ordre de {@link stopAreaModes}. */
const heaviestMode = (a: StopAreaMode, b: StopAreaMode) =>
	stopAreaModes.indexOf(a) <= stopAreaModes.indexOf(b) ? a : b;

/** `GEOADD` refuse les latitudes au-delà de ±85,05° ; un arrêt en (0, 0) trahit des coordonnées absentes. */
const isIndexable = ({ latitude, longitude }: StopAreaManifest) =>
	Math.abs(latitude) <= 85.05 && Math.abs(longitude) <= 180 && (latitude !== 0 || longitude !== 0);

/**
 * Quais d'une station, un par référence publiée. `mapStopRef` peut confondre plusieurs arrêts GTFS
 * en un seul quai — à la SNCF, `StopPoint:OCETrain TER-87411017` et `StopPoint:OCECar TER-87411017`
 * deviennent tous deux `87411017` : les dessertes ne les distinguent plus, la carte non plus. Le quai
 * prend alors le plus lourd de leurs modes, et la position de l'arrêt qui l'apporte ; publiés tels
 * quels, ils s'empileraient au même endroit et l'arrêt de car pourrait masquer la gare.
 */
function buildStopPoints(
	areaName: string,
	stops: Stop[],
	refOf: (stop: Stop) => string,
	stopModeOf: (stop: Stop) => StopAreaMode,
): StopPoint[] {
	const stopsByRef = Map.groupBy(stops, refOf);

	return [...stopsByRef].map(([ref, [first, ...others]]) => {
		let leading = first!;
		let mode = stopModeOf(leading);
		for (const stop of others) {
			const stopMode = stopModeOf(stop);
			if (heaviestMode(mode, stopMode) !== mode) {
				leading = stop;
				mode = stopMode;
			}
		}

		// Des arrêts confondus qui se contredisent laissent l'accès au quai inconnu.
		const wheelchairBoarding = others.every((stop) => stop.wheelchairBoarding === first!.wheelchairBoarding)
			? first!.wheelchairBoarding
			: undefined;

		return {
			ref,
			...(leading.name !== areaName ? { name: leading.name } : {}),
			latitude: leading.latitude,
			longitude: leading.longitude,
			...(leading.platformCode !== undefined ? { platformCode: leading.platformCode } : {}),
			mode,
			...(wheelchairBoarding !== undefined ? { wheelchairBoarding } : {}),
		};
	});
}

function buildStopAreaManifests(providerId: string, source: Source, updatedAt: string): StopAreaManifest[] {
	const gtfs = source.gtfs;
	if (gtfs === undefined) return [];

	const { mapLineRef, mapStopRef } = source.options;
	const networkOf = createTripNetworkResolver(source);
	const stopRefOf = (networkRef: string, stopId: string) => `${networkRef}:StopPoint:${mapStopRef?.(stopId) ?? stopId}`;

	// Réseaux et lignes de chaque station, relevés sur les courses qui la desservent : une source peut
	// alimenter plusieurs réseaux, et c'est la course, pas l'arrêt, qui en décide.
	const services = new Map<
		string,
		{ courseCountByNetwork: Map<string, number>; lineRefs: Set<string>; mode: StopAreaMode }
	>();
	const record = (areaId: string, networkRef: string, route: Route) => {
		const mode = modeOf(route.type);
		let service = services.get(areaId);
		if (service === undefined) {
			service = { courseCountByNetwork: new Map(), lineRefs: new Set(), mode };
			services.set(areaId, service);
		}
		service.courseCountByNetwork.set(networkRef, (service.courseCountByNetwork.get(networkRef) ?? 0) + 1);
		service.lineRefs.add(`${networkRef}:Line:${mapLineRef?.(route.id) ?? route.id}`);
		service.mode = heaviestMode(service.mode, mode);
	};

	// Mode de chaque quai, relevé à part : dans une gare, l'arrêt de bus du parvis reste un arrêt de bus.
	// Toutes les dessertes comptent, terminus et descentes seules compris : un quai où l'on ne fait que
	// descendre d'un bus reste un arrêt de bus, même dans une station de métro.
	const stopModes = new Map<string, StopAreaMode>();
	const recordStopMode = (stopId: string, route: Route) => {
		const mode = modeOf(route.type);
		const stopMode = stopModes.get(stopId);
		stopModes.set(stopId, stopMode !== undefined ? heaviestMode(stopMode, mode) : mode);
	};

	const { flagsBitmask, stops, tripStart, tripCount } = gtfs.stopTimeStore;
	for (const trip of gtfs.tripsByIdx) {
		if (trip === undefined) continue;
		const start = tripStart[trip.idx]!;
		const end = start + tripCount[trip.idx]!;
		for (let index = start; index < end; index += 1) {
			recordStopMode(stops[index]!.id, trip.route);
		}
	}

	// L'index tient tous les passages, terminus compris : une station où l'on ne fait que descendre
	// n'est publiée que si la source y propose les arrivées — sinon, son tableau serait vide.
	const { stopArrivals } = source.options;
	const offersArrivals = (route: Route) =>
		typeof stopArrivals === "function" ? stopArrivals(route) : stopArrivals === true;
	const departingAreaIds = new Set<string>();
	const arrivalAreaIds = new Set<string>();

	for (const stopArea of gtfs.stopAreas.values()) {
		for (const [stopTimeIdx, tripIdx] of gtfs.stopIndex.entriesOf(stopArea.id)) {
			const trip = gtfs.tripsByIdx[tripIdx];
			if (trip === undefined) continue;
			record(stopArea.id, networkOf(trip), trip.route);

			const departs =
				stopTimeIdx !== trip.stopTimeStart + trip.stopTimeCount - 1 &&
				(flagsBitmask[stopTimeIdx]! & NO_PICKUP_FLAG) === 0;
			if (departs) departingAreaIds.add(stopArea.id);
			if (offersArrivals(trip.route)) arrivalAreaIds.add(stopArea.id);
		}
	}

	// Arrêts créés par le flux temps réel : seules les courses déviées les desservent.
	for (const journeyKey of source.modifiedJourneyKeys) {
		const journey = gtfs.journeys.get(journeyKey);
		if (journey === undefined) continue;
		for (const call of journey.calls) {
			if (source.realtimeStopAreas.has(call.stop.id)) {
				record(call.stop.id, networkOf(journey.trip, journey), journey.trip.route);
				recordStopMode(call.stop.id, journey.trip.route);
				departingAreaIds.add(call.stop.id);
				if (offersArrivals(journey.trip.route)) arrivalAreaIds.add(call.stop.id);
			}
		}
	}

	return [...gtfs.stopAreas.values(), ...source.realtimeStopAreas.values()].flatMap((stopArea) => {
		const service = services.get(stopArea.id);
		if (service === undefined) return [];
		const arrivals = arrivalAreaIds.has(stopArea.id);
		if (!arrivals && !departingAreaIds.has(stopArea.id)) return [];

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
				stopRefs: [
					...new Set(networkRefs.flatMap((network) => stopArea.stops.map((stop) => stopRefOf(network, stop.id)))),
				],
				stopPoints: buildStopPoints(
					stopArea.name,
					stopArea.stops,
					(stop) => stopRefOf(networkRef, stop.id),
					(stop) =>
						// Un quai qu'aucune course ne dessert reprend le mode de sa station.
						stopModes.get(stop.id) ?? service.mode,
				),
				providerId,
				sourceId: source.id,
				lineRefs: [...service.lineRefs].sort(),
				mode: service.mode,
				...(arrivals ? { arrivals } : {}),
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

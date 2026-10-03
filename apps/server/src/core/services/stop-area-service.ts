import { STOP_AREAS_GEO_KEY, type StopAreaManifest, stopAreaKey, stopPointAreaKey } from "@bus-tracker/contracts";
import { inArray } from "drizzle-orm";

import { redis } from "../../index.js";
import { useCache } from "../../utils/use-cache.js";
import { database } from "../database/database.js";
import { networksTable } from "../database/schema.js";

/**
 * Station telle que servie par l'API : sa fiche Redis, rattachée aux réseaux connus de la base —
 * `networkId` pour le principal, `networkIds` pour tous ceux qui la desservent.
 */
export type StopArea = StopAreaManifest & { networkId: number; networkIds: number[] };

export type StopAreaBounds = {
	swLat: number;
	swLon: number;
	neLat: number;
	neLon: number;
};

const EARTH_RADIUS_KM = 6_371;

/**
 * Identifiants de réseau par référence. Les fiches ne portent que la référence — le provider ignore
 * les identifiants de la base — et un réseau ne change pas de référence : la table est gardée en
 * mémoire, et seules les références encore inconnues sont cherchées en base.
 */
const networkIdsByRef = new Map<string, number | null>();

/** Oubli périodique, pour retrouver un réseau créé après la première publication de ses stations. */
setInterval(() => networkIdsByRef.clear(), 30 * 60_000).unref();

export async function resolveNetworkIds(networkRefs: string[]) {
	const unknownRefs = [...new Set(networkRefs)].filter((ref) => !networkIdsByRef.has(ref));
	if (unknownRefs.length > 0) {
		const networks = await database
			.select({ id: networksTable.id, ref: networksTable.ref })
			.from(networksTable)
			.where(inArray(networksTable.ref, unknownRefs));

		for (const ref of unknownRefs) {
			networkIdsByRef.set(ref, networks.find((network) => network.ref === ref)?.id ?? null);
		}
	}
	return networkIdsByRef;
}

const networkRefsOf = (manifest: StopAreaManifest) => manifest.networkRefs ?? [manifest.networkRef];

/**
 * Réseaux des fiches. Seuls comptent ceux qui existent en base — un réseau naît de sa première course
 * publiée — et une station dont aucun réseau n'y figure encore est écartée.
 */
async function attachNetworks(manifests: StopAreaManifest[]): Promise<StopArea[]> {
	const knownNetworkIds = await resolveNetworkIds(manifests.flatMap(networkRefsOf));
	return manifests.flatMap((manifest) => {
		const networkIds = networkRefsOf(manifest).flatMap((ref) => knownNetworkIds.get(ref) ?? []);
		if (networkIds.length === 0) return [];

		const networkId = knownNetworkIds.get(manifest.networkRef) ?? networkIds[0]!;
		return [{ ...manifest, networkId, networkIds }];
	});
}

/**
 * Fiches déjà lues et décodées. Chaque déplacement de la carte relit des centaines de fiches, pour la
 * plupart les mêmes : elles ne changent qu'avec la ressource GTFS de leur source, dont la republication
 * les invalide ({@link invalidateStopAreaManifests}).
 */
const manifestsCache = useCache<StopAreaManifest>(300_000);

/** Oublie les fiches d'une source qui vient de republier son inventaire, ou toutes à défaut. */
export function invalidateStopAreaManifests(source?: { providerId: string; sourceId: string }) {
	if (source === undefined) {
		manifestsCache.clear();
		return;
	}
	manifestsCache.deleteWhere(
		(manifest) => manifest.providerId === source.providerId && manifest.sourceId === source.sourceId,
	);
}

/**
 * Lit les fiches de stations. Une station présente dans l'index mais dont la fiche a expiré — son
 * provider a cessé de la publier — en est retirée au passage.
 */
async function readStopAreas(refs: string[]) {
	if (refs.length === 0) return [];

	// L'ordre des références est conservé : celui de la recherche géographique, du centre vers les bords.
	const manifests = refs.map((ref) => manifestsCache.get(ref));
	const missingIndexes = manifests.flatMap((manifest, index) => (manifest === undefined ? [index] : []));

	const expiredRefs: string[] = [];
	if (missingIndexes.length > 0) {
		const rawManifests = await redis.mGet(missingIndexes.map((index) => stopAreaKey(refs[index]!)));
		rawManifests.forEach((rawManifest, position) => {
			const index = missingIndexes[position]!;
			if (rawManifest === null || rawManifest === undefined) {
				expiredRefs.push(refs[index]!);
				return;
			}
			const manifest: StopAreaManifest = JSON.parse(rawManifest);
			manifestsCache.set(refs[index]!, manifest);
			manifests[index] = manifest;
		});
	}

	if (expiredRefs.length > 0) {
		void redis.zRem(STOP_AREAS_GEO_KEY, expiredRefs).catch(() => void 0);
	}

	return manifests.filter((manifest) => manifest !== undefined);
}

/**
 * Stations de l'emprise, les plus proches de son centre d'abord : si la limite tronque le résultat,
 * ce sont celles du bord de l'écran qui manquent.
 */
export async function findStopAreasWithin(
	{ swLat, swLon, neLat, neLon }: StopAreaBounds,
	{ limit, networkIds }: { limit: number; networkIds?: number[] },
): Promise<StopArea[]> {
	if (!redis.isReady) return [];

	const latitude = (swLat + neLat) / 2;
	const longitude = (swLon + neLon) / 2;
	const toRadians = Math.PI / 180;
	const height = (neLat - swLat) * toRadians * EARTH_RADIUS_KM;
	const width = (neLon - swLon) * toRadians * EARTH_RADIUS_KM * Math.cos(latitude * toRadians);

	const refs = await redis.geoSearch(
		STOP_AREAS_GEO_KEY,
		{ longitude, latitude },
		{ width, height, unit: "km" },
		// Filtrée par réseau après coup : la marge évite qu'un réseau voisin, plus dense, n'évince tout.
		{ SORT: "ASC", COUNT: networkIds !== undefined ? limit * 4 : limit },
	);

	const stopAreas = await attachNetworks(await readStopAreas(refs));
	return (
		networkIds !== undefined
			? stopAreas.filter((stopArea) => stopArea.networkIds.some((networkId) => networkIds.includes(networkId)))
			: stopAreas
	).slice(0, limit);
}

export async function findStopArea(ref: string): Promise<StopArea | undefined> {
	if (!redis.isReady) return;
	const [stopArea] = await attachNetworks(await readStopAreas([ref]));
	return stopArea;
}

/** Station d'un quai, retrouvée par la correspondance que publie le provider. */
export async function findStopAreaOfStopPoint(stopPointRef: string): Promise<StopArea | undefined> {
	if (!redis.isReady) return;
	const stopAreaRef = await redis.get(stopPointAreaKey(stopPointRef));
	return stopAreaRef !== null ? findStopArea(stopAreaRef) : undefined;
}

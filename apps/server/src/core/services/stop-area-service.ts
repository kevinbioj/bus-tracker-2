import { STOP_AREAS_GEO_KEY, type StopAreaManifest, stopAreaKey, stopPointAreaKey } from "@bus-tracker/contracts";
import { inArray } from "drizzle-orm";

import { redis } from "../../index.js";
import { database } from "../database/database.js";
import { networksTable } from "../database/schema.js";

/** Station telle que servie par l'API : sa fiche Redis, rattachée au réseau connu de la base. */
export type StopArea = StopAreaManifest & { networkId: number };

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

async function resolveNetworkIds(networkRefs: string[]) {
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

/** Réseau des fiches : celles dont le réseau n'existe pas (encore) en base sont écartées. */
async function attachNetworks(manifests: StopAreaManifest[]): Promise<StopArea[]> {
	const networkIds = await resolveNetworkIds(manifests.map(({ networkRef }) => networkRef));
	return manifests.flatMap((manifest) => {
		const networkId = networkIds.get(manifest.networkRef);
		return networkId !== null && networkId !== undefined ? [{ ...manifest, networkId }] : [];
	});
}

/**
 * Lit les fiches de stations. Une station présente dans l'index mais dont la fiche a expiré — son
 * provider a cessé de la publier — en est retirée au passage.
 */
async function readStopAreas(refs: string[]) {
	if (refs.length === 0) return [];

	const rawManifests = await redis.mGet(refs.map(stopAreaKey));

	const manifests: StopAreaManifest[] = [];
	const expiredRefs: string[] = [];
	rawManifests.forEach((rawManifest, index) => {
		if (rawManifest === null || rawManifest === undefined) {
			expiredRefs.push(refs[index]!);
			return;
		}
		manifests.push(JSON.parse(rawManifest));
	});

	if (expiredRefs.length > 0) {
		void redis.zRem(STOP_AREAS_GEO_KEY, expiredRefs).catch(() => void 0);
	}

	return manifests;
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
		networkIds !== undefined ? stopAreas.filter(({ networkId }) => networkIds.includes(networkId)) : stopAreas
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

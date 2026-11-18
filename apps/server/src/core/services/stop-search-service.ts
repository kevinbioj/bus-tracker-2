import { STOP_AREAS_GEO_KEY, type StopAreaManifest, type StopAreaMode, stopAreaKey } from "@bus-tracker/contracts";

import { redis } from "../../index.js";
import { normalizeSearchText } from "../../utils/search-text.js";
import { createStringPool } from "../../utils/string-pool.js";
import { resolveNetworkIds } from "./stop-area-service.js";

const READ_BATCH_SIZE = 1_000;
const MAX_INDEX_AGE_MS = 10 * 60_000;
const MIN_REBUILD_INTERVAL_MS = 60_000;

export type IndexedStopArea = {
	ref: string;
	name: string;
	searchName: string;
	latitude: number;
	longitude: number;
	mode: StopAreaMode;
	networkIds: number[];
	lineRefs: string[];
};

type StopSearchIndex = {
	stopAreas: IndexedStopArea[];
	byLineRef: Map<string, IndexedStopArea[]>;
	builtAtMs: number;
};

export type StopSearchMatch = IndexedStopArea & { score: number };

let index: StopSearchIndex | undefined;
let building: Promise<StopSearchIndex> | undefined;
let stale = false;

export function markStopSearchIndexStale() {
	stale = true;
}

export function buildStopSearchIndex(manifests: StopAreaManifest[], networkIdsByRef: Map<string, number>) {
	const strings = createStringPool();
	const stopAreas: IndexedStopArea[] = [];
	const byLineRef = new Map<string, IndexedStopArea[]>();

	for (const manifest of manifests) {
		const networkIds = (manifest.networkRefs ?? [manifest.networkRef]).flatMap(
			(networkRef) => networkIdsByRef.get(networkRef) ?? [],
		);
		if (networkIds.length === 0) continue;

		const stopArea: IndexedStopArea = {
			ref: manifest.ref,
			name: strings.intern(manifest.name),
			searchName: strings.intern(normalizeSearchText(manifest.name)),
			latitude: manifest.latitude,
			longitude: manifest.longitude,
			mode: manifest.mode ?? "BUS",
			networkIds,
			lineRefs: manifest.lineRefs.map((lineRef) => strings.intern(lineRef)),
		};
		stopAreas.push(stopArea);

		for (const lineRef of stopArea.lineRefs) {
			const lineStopAreas = byLineRef.get(lineRef);
			if (lineStopAreas === undefined) byLineRef.set(lineRef, [stopArea]);
			else lineStopAreas.push(stopArea);
		}
	}

	return { stopAreas, byLineRef, builtAtMs: Date.now() } satisfies StopSearchIndex;
}

async function loadStopSearchIndex() {
	const refs = await redis.zRange(STOP_AREAS_GEO_KEY, 0, -1);

	const manifests: StopAreaManifest[] = [];
	for (let offset = 0; offset < refs.length; offset += READ_BATCH_SIZE) {
		const batch = refs.slice(offset, offset + READ_BATCH_SIZE);
		const rawManifests = await redis.mGet(batch.map(stopAreaKey));
		for (const rawManifest of rawManifests) {
			if (typeof rawManifest === "string") manifests.push(JSON.parse(rawManifest));
		}
	}

	const networkIdsByRef = await resolveNetworkIds(
		manifests.flatMap((manifest) => manifest.networkRefs ?? [manifest.networkRef]),
	);
	return buildStopSearchIndex(manifests, networkIdsByRef);
}

function rebuild() {
	building ??= loadStopSearchIndex()
		.then((built) => {
			index = built;
			stale = false;
			return built;
		})
		.finally(() => {
			building = undefined;
		});
	return building;
}

async function getStopSearchIndex() {
	if (index === undefined) {
		if (!redis.isReady) return undefined;
		return rebuild();
	}

	const ageMs = Date.now() - index.builtAtMs;
	if (redis.isReady && ageMs >= MIN_REBUILD_INTERVAL_MS && (stale || ageMs >= MAX_INDEX_AGE_MS)) {
		void rebuild().catch((error) => console.error("✘ Failed to rebuild the stop search index:", error));
	}
	return index;
}

function scoreOf(searchName: string, query: string, queryWords: string[]) {
	if (searchName === query) return 3;
	if (searchName.startsWith(query)) return 2;
	if (searchName.includes(query)) return 1;
	const nameWords = searchName.split(" ");
	return queryWords.every((word) => nameWords.some((nameWord) => nameWord.startsWith(word))) ? 0.5 : 0;
}

export function searchIndexedStopAreas(
	stopAreas: IndexedStopArea[],
	{ query, networkIds, limit }: { query: string; networkIds?: number[]; limit: number },
): StopSearchMatch[] {
	const normalizedQuery = normalizeSearchText(query);
	if (normalizedQuery === "") return [];
	const queryWords = normalizedQuery.split(" ");

	const matches: StopSearchMatch[] = [];
	for (const stopArea of stopAreas) {
		if (networkIds !== undefined && !stopArea.networkIds.some((networkId) => networkIds.includes(networkId))) {
			continue;
		}
		const score = scoreOf(stopArea.searchName, normalizedQuery, queryWords);
		if (score > 0) matches.push({ ...stopArea, score });
	}

	return matches
		.sort((a, b) => b.score - a.score || a.name.length - b.name.length || a.name.localeCompare(b.name))
		.slice(0, limit);
}

export async function searchStopAreas(options: { query: string; networkIds?: number[]; limit: number }) {
	const current = await getStopSearchIndex();
	return current !== undefined ? searchIndexedStopAreas(current.stopAreas, options) : undefined;
}

export async function findStopAreasOfLine(lineRefs: string[]) {
	const current = await getStopSearchIndex();
	if (current === undefined) return undefined;

	const stopAreas = new Map<string, IndexedStopArea>();
	for (const lineRef of lineRefs) {
		for (const stopArea of current.byLineRef.get(lineRef) ?? []) stopAreas.set(stopArea.ref, stopArea);
	}
	return [...stopAreas.values()].toSorted((a, b) => a.name.localeCompare(b.name));
}

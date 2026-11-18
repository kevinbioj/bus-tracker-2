import { decodeLinePath, type EncodedLinePath, type LinePath, toLinePathRef } from "@bus-tracker/contracts";
import { desc, eq, sql } from "drizzle-orm";
import { useCache } from "../../utils/use-cache.js";
import { database } from "../database/database.js";
import { lineActivitiesTable, linesTable } from "../database/schema.js";
import { redis } from "../redis.js";

const lineDetailsCache = useCache<LineDetails | null>(60_000, 1_024);
const linePathCache = useCache<LinePath | null>(60_000, 1_024);

/** Ligne et ses mois d'activité, partagés entre l'API et le temps réel pendant une minute. */
export async function findLineDetails(lineId: number) {
	const line = await lineDetailsCache.getOrLoad(String(lineId), async () => (await loadLineDetails(lineId)) ?? null);
	return line ?? undefined;
}

/** Tracé de la ligne, partagé de même. Redis indisponible, rien n'est retenu. */
export async function findLinePath(line: { id: number; references: string[] | null }) {
	const key = String(line.id);
	if (!redis.isReady) return linePathCache.get(key) ?? undefined;
	const path = await linePathCache.getOrLoad(key, async () => (await loadLinePath(line)) ?? null);
	return path ?? undefined;
}

export async function loadLineDetails(lineId: number) {
	const [line] = await database.select().from(linesTable).where(eq(linesTable.id, lineId));
	if (line === undefined) return undefined;

	const activeMonths = await database
		.select({ month: sql<string>`DISTINCT TO_CHAR(service_date, 'YYYY-MM')` })
		.from(lineActivitiesTable)
		.where(eq(lineActivitiesTable.lineId, line.id));

	const [latestActivity] = await database
		.select({ serviceDate: lineActivitiesTable.serviceDate })
		.from(lineActivitiesTable)
		.where(eq(lineActivitiesTable.lineId, line.id))
		.orderBy(desc(lineActivitiesTable.serviceDate))
		.limit(1);

	return {
		...line,
		activeMonths: activeMonths.map(({ month }) => month).toSorted((a, b) => a.localeCompare(b)),
		latestServiceDate: latestActivity?.serviceDate ?? null,
	};
}

export type LineDetails = NonNullable<Awaited<ReturnType<typeof loadLineDetails>>>;

export async function loadLinePath(line: { references: string[] | null }) {
	const refs = line.references ?? [];
	if (refs.length === 0) return undefined;

	const rawPaths = await redis.mGet(refs.map(toLinePathRef));
	// Chaque version d'encodage a sa propre précision : les segments ne sont dédoublonnés qu'entre
	// tracés de même version.
	const encodedSegments = new Map<EncodedLinePath["v"], Set<string>>();

	for (const rawPath of rawPaths) {
		if (rawPath === null) continue;

		const encodedPath = JSON.parse(rawPath) as EncodedLinePath;
		if ((encodedPath.v !== 1 && encodedPath.v !== 2) || !Array.isArray(encodedPath.segments)) continue;

		let segments = encodedSegments.get(encodedPath.v);
		if (segments === undefined) {
			segments = new Set();
			encodedSegments.set(encodedPath.v, segments);
		}

		for (const segment of encodedPath.segments) {
			segments.add(segment);
		}
	}

	if (encodedSegments.size === 0) return undefined;

	return {
		segments: Array.from(encodedSegments).flatMap(
			([v, segments]) => decodeLinePath({ v, segments: Array.from(segments) }).segments,
		),
	} satisfies LinePath;
}

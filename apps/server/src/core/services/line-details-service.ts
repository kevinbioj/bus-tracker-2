import { decodeLinePath, type EncodedLinePath, type LinePath } from "@bus-tracker/contracts";
import { desc, eq, sql } from "drizzle-orm";

import { redis } from "../../index.js";
import { database } from "../database/database.js";
import { lineActivitiesTable, linesTable } from "../database/schema.js";

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

	const rawPaths = await redis.mGet(refs.map((ref) => `${ref}:LinePath`));
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

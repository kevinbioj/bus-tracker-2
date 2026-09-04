import { type DataSourceManifest, dataSourceManifestSchema } from "@bus-tracker/contracts";
import { ArkErrors } from "arktype";
import { and, eq, gte, sql } from "drizzle-orm";

import { database } from "../database/database.js";
import { type DataSourceEntity, dataSourcesTable } from "../database/schema.js";

/**
 * Durée au-delà de laquelle une source qui n'a plus été annoncée par son provider cesse d'être
 * affichée. La ligne est conservée : le provider peut être temporairement arrêté, et une
 * réapparition doit retrouver son `firstSeenAt`.
 */
const DATA_SOURCE_FRESHNESS_MS = 7 * 24 * 60 * 60 * 1000;

/** Valide un lot publié sur le canal Redis. Les entrées invalides sont signalées puis ignorées. */
export function parseDataSourceManifests(payload: unknown): DataSourceManifest[] {
	if (!Array.isArray(payload)) return [];

	const manifests: DataSourceManifest[] = [];
	let didWarn = false;

	for (const entry of payload) {
		const result = dataSourceManifestSchema(entry);
		if (result instanceof ArkErrors) {
			if (!didWarn) {
				console.warn("⚠ Rejected object(s) from data sources channel, sample:", entry);
				console.error(result.toString());
				didWarn = true;
			}
			continue;
		}
		manifests.push(result);
	}

	return manifests;
}

export async function upsertDataSources(manifests: DataSourceManifest[]) {
	if (manifests.length === 0) return;

	await database
		.insert(dataSourcesTable)
		.values(
			manifests.map((manifest) => ({
				kind: manifest.kind,
				providerId: manifest.providerId,
				sourceId: manifest.sourceId,
				networkRefs: manifest.networkRefs,
				staticFeed: manifest.staticFeed,
				realtimeFeeds: manifest.realtimeFeeds,
				authenticated: manifest.authenticated,
				lastSeenAt: Temporal.Instant.from(manifest.updatedAt),
			})),
		)
		.onConflictDoUpdate({
			target: [dataSourcesTable.providerId, dataSourcesTable.sourceId],
			// `hidden` et `firstSeenAt` sont volontairement absents : le premier est une décision
			// éditoriale qu'une republication ne doit jamais écraser, le second date la découverte.
			set: {
				kind: sql`excluded.kind`,
				networkRefs: sql`excluded.network_refs`,
				staticFeed: sql`excluded.static_feed`,
				realtimeFeeds: sql`excluded.realtime_feeds`,
				authenticated: sql`excluded.authenticated`,
				lastSeenAt: sql`excluded.last_seen_at`,
			},
		});
}

/** Sources encore annoncées par leur provider et non masquées, triées de façon stable. */
export async function getFreshDataSources(): Promise<DataSourceEntity[]> {
	const freshSince = Temporal.Now.instant().subtract({ milliseconds: DATA_SOURCE_FRESHNESS_MS });

	const dataSourceList = await database
		.select()
		.from(dataSourcesTable)
		.where(and(gte(dataSourcesTable.lastSeenAt, freshSince), eq(dataSourcesTable.hidden, false)));

	return dataSourceList.sort(
		(a, b) => a.providerId.localeCompare(b.providerId) || a.sourceId.localeCompare(b.sourceId),
	);
}

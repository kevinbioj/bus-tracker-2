import { DATA_SOURCES_CHANNEL, type DataSourceManifest, type DataSourceRealtimeFeed } from "@bus-tracker/contracts";
import { captureException } from "@bus-tracker/monitoring";

import type { Source } from "../model/source.js";
import { redactHref } from "../utils/redact-href.js";

/** Seule la publication est requise : évite d'exposer la variance des types du client Redis. */
type RedisPublisher = { publish: (channel: string, message: string) => Promise<unknown> };

/** Dernière charge utile publiée, pour n'émettre que sur changement effectif. */
let lastPublishedPayload: string | undefined;

/**
 * Réseaux connus de la source. Les refs observées priment ; à défaut, une configuration dont
 * {@link Source.options.getNetworkRef} est constante répond sans course et permet d'annoncer la
 * source dès le démarrage. Une configuration dépendant de la course renvoie `undefined` ou lève,
 * auquel cas la source attend sa première publication de véhicule pour apparaître.
 */
function resolveNetworkRefs(source: Source) {
	const networkRefs = new Set(source.observedNetworkRefs);

	if (networkRefs.size === 0) {
		try {
			const networkRef = source.options.getNetworkRef();
			if (typeof networkRef === "string" && networkRef.length > 0) {
				networkRefs.add(networkRef);
			}
		} catch {
			// Configuration dépendant de la course : rien à déduire hors contexte.
		}
	}

	return [...networkRefs].sort();
}

function buildRealtimeFeeds(source: Source): { feed: DataSourceRealtimeFeed; redacted: boolean }[] {
	return (source.options.realtimeResourceHrefs ?? []).map((resource) => {
		const rawHref = typeof resource === "string" ? resource : resource.href;
		const entityTypes = source.observedRealtimeEntityTypes.get(rawHref);
		const { href, redacted } = redactHref(rawHref);

		return {
			feed: {
				href,
				...(entityTypes !== undefined && entityTypes.size > 0 ? { entityTypes: [...entityTypes].sort() } : {}),
			},
			redacted,
		};
	});
}

export function buildDataSourceManifest(providerId: string, source: Source): DataSourceManifest {
	const { options } = source;

	const staticFeed = redactHref(options.staticResourceHref);
	const realtimeFeeds = buildRealtimeFeeds(source);

	// Une clé portée par l'URL n'apparaît dans aucune option d'authentification : son caviardage
	// est le seul indice que la source en réclame une.
	const carriesUrlCredential = staticFeed.redacted || realtimeFeeds.some(({ redacted }) => redacted);

	return {
		kind: "GTFS",
		providerId,
		sourceId: source.id,
		networkRefs: resolveNetworkRefs(source),
		staticFeed: {
			href: staticFeed.href,
			lastModified: source.gtfs?.lastModified ?? null,
			...(source.gtfs !== undefined ? { importedAt: source.gtfs.importedAt.toString() } : {}),
		},
		realtimeFeeds: realtimeFeeds.map(({ feed }) => feed),
		authenticated: Boolean(options.auth ?? options.staticAuth ?? options.realtimeAuth) || carriesUrlCredential,
		updatedAt: Temporal.Now.instant().toString(),
	};
}

/**
 * Publie l'inventaire des sources du provider. Hors publication forcée (démarrage, mise à jour des
 * ressources), l'émission n'a lieu que si l'inventaire a changé : le cycle de calcul est fréquent
 * et l'inventaire, lui, est quasi statique.
 */
export async function publishDataSourceManifests(
	redis: RedisPublisher,
	providerId: string,
	sources: Source[],
	{ force = false }: { force?: boolean } = {},
) {
	try {
		const manifests = sources
			.map((source) => buildDataSourceManifest(providerId, source))
			.filter((manifest) => manifest.networkRefs.length > 0);

		if (manifests.length === 0) return;

		// `updatedAt` change à chaque appel : la comparaison porte sur le reste de l'inventaire.
		const fingerprint = JSON.stringify(manifests.map(({ updatedAt, ...manifest }) => manifest));
		if (!force && fingerprint === lastPublishedPayload) return;

		await redis.publish(DATA_SOURCES_CHANNEL, JSON.stringify(manifests));
		lastPublishedPayload = fingerprint;
	} catch (cause) {
		console.error(new Error("Failed to publish data source manifests.", { cause }));
		captureException(cause);
	}
}

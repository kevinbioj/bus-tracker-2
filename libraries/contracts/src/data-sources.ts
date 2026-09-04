import { type } from "arktype";

/** Canal Redis sur lequel les providers publient l'inventaire de leurs sources de données. */
export const DATA_SOURCES_CHANNEL = "data-sources";

export const dataSourceKindEnum = type("'GTFS'");
export type DataSourceKind = typeof dataSourceKindEnum.infer;

export const dataSourceRealtimeEntityTypeEnum = type("'TRIP_UPDATES'|'VEHICLE_POSITIONS'");
export type DataSourceRealtimeEntityType = typeof dataSourceRealtimeEntityTypeEnum.infer;

export const dataSourceStaticFeedSchema = type({
	href: "string",
	"lastModified?": "string | null",
	"importedAt?": "string.date.iso",
});

export type DataSourceStaticFeed = typeof dataSourceStaticFeedSchema.infer;

export const dataSourceRealtimeFeedSchema = type({
	href: "string",
	/** Types d'entités effectivement observés dans le flux. Vide tant que rien n'a été lu. */
	"entityTypes?": dataSourceRealtimeEntityTypeEnum.array(),
});

export type DataSourceRealtimeFeed = typeof dataSourceRealtimeFeedSchema.infer;

/**
 * Inventaire d'une source de données telle qu'elle est réellement consommée par un provider.
 * Publié périodiquement par le provider, persisté par le serveur, affiché en attributions.
 * Les URLs sont expurgées de leurs secrets par le provider avant publication.
 */
export const dataSourceManifestSchema = type({
	kind: dataSourceKindEnum,
	/** Identifiant de la configuration du provider (ex. « rouen »). */
	providerId: "string",
	/** Identifiant de la source au sein de la configuration (ex. « tcar »). */
	sourceId: "string",
	/** Réseaux alimentés par la source : une source peut en alimenter plusieurs. */
	networkRefs: "string[]",
	staticFeed: dataSourceStaticFeedSchema,
	realtimeFeeds: dataSourceRealtimeFeedSchema.array(),
	/**
	 * Vrai si la source requiert une authentification, qu'elle passe par des en-têtes ou par une clé
	 * portée par l'URL. Les identifiants eux-mêmes ne sont jamais publiés.
	 */
	authenticated: "boolean",
	updatedAt: "string.date.iso",
});

export type DataSourceManifest = typeof dataSourceManifestSchema.infer;

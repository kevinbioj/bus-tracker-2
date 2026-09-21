import { type } from "arktype";

import { vehicleJourneyCallStatusEnum } from "./vehicle-journeys.js";

/*
 * Inventaire des stations, tenu dans Redis par les providers sur le modèle des tracés de ligne. Il
 * n'a pas sa place en base : c'est une donnée dérivée du GTFS, volumineuse à l'échelle de tous les
 * réseaux, et dont les identifiants changent d'une révision à l'autre — des lignes figées en base
 * s'y accumuleraient. Ici, chaque station expire d'elle-même si son provider cesse de la republier.
 */

/** Index géographique (`GEOADD` / `GEOSEARCH`) de toutes les stations, par référence. */
export const STOP_AREAS_GEO_KEY = "stop-areas:geo";

/** Fiche d'une station ({@link StopAreaManifest}, en JSON). */
export const stopAreaKey = (stopAreaRef: string) => `${stopAreaRef}:StopAreaManifest`;

/**
 * Stations publiées par une source : à la republication, celles qui n'y figurent plus sont retirées
 * de l'index et leur fiche supprimée, sans attendre leur expiration.
 */
export const stopAreasSourceKey = (providerId: string, sourceId: string) =>
	`stop-areas:source:${providerId}:${sourceId}`;

/** Quais publiés par une source : ceux qui n'y figurent plus voient leur correspondance effacée. */
export const stopPointsSourceKey = (providerId: string, sourceId: string) =>
	`stop-points:source:${providerId}:${sourceId}`;

/**
 * Canal sur lequel un provider signale la republication de l'inventaire d'une source : le serveur y
 * vide ses caches, pour ne pas continuer de servir une station que la nouvelle ressource a supprimée.
 */
export const STOP_AREAS_INVALIDATION_CHANNEL = "stop-areas:invalidated";

/**
 * Station d'un quai : un quai sélectionné sur la carte suffit à retrouver le tableau de sa station,
 * sans que le client ait à porter les deux références.
 */
export const stopPointAreaKey = (stopPointRef: string) => `${stopPointRef}:StopArea`;

/** Durée de vie des fiches, alignée sur celle des tracés de ligne : largement au-delà de leur rafraîchissement. */
export const STOP_AREA_TTL_SECONDS = 172_800;

/**
 * Canal de demande de prochains passages, propre à chaque provider : le serveur sait quel provider
 * détient une station (l'inventaire le lui dit), inutile de diffuser la demande à tous.
 */
export const stopDeparturesRequestChannel = (providerId: string) => `stop-departures:request:${providerId}`;

/** Canal de réponse, commun : chaque réponse porte l'identifiant de la demande à laquelle elle répond. */
export const STOP_DEPARTURES_REPLY_CHANNEL = "stop-departures:reply";

/** Quai d'une station : un arrêt physique, avec sa position propre. */
export const stopPointSchema = type({
	/** Sous la forme exacte des `stopRef` des dessertes. */
	ref: "string",
	latitude: "number",
	longitude: "number",
	"platformCode?": "string",
});

export type StopPoint = typeof stopPointSchema.infer;

/**
 * Fiche d'une station telle qu'un provider la publie : un regroupement des quais desservis d'un même
 * lieu, seule granularité affichée sur la carte — deux marqueurs face à face pour un arrêt de rue
 * n'y apprendraient rien.
 */
export const stopAreaManifestSchema = type({
	/** `${networkRef}:StopArea:${areaId}`, sur le modèle des `StopPoint` portés par les dessertes. */
	ref: "string",
	name: "string",
	/**
	 * Barycentre des quais regroupés : la position déclarée d'une station porte parfois sur son
	 * bâtiment plutôt que sur ses quais.
	 */
	latitude: "number",
	longitude: "number",
	/**
	 * Réseau principal de la station — celui qui la dessert le plus — qui préfixe sa référence et
	 * celles de ses quais dans `stopPoints`.
	 */
	networkRef: "string",
	/**
	 * Tous les réseaux qui desservent la station : une même source peut en alimenter plusieurs (une
	 * gare desservie par TER, Intercités et TGV). Absent : le seul `networkRef`.
	 */
	"networkRefs?": "string[]",
	/**
	 * Quais regroupés, sous la forme exacte des `stopRef` des dessertes : un quai figure une fois par
	 * réseau qui le dessert, la référence d'un arrêt portant le réseau de la course.
	 */
	stopRefs: "string[]",
	/**
	 * Les mêmes quais, positionnés : affichés à la place de la station aux zooms les plus forts.
	 * Optionnel pour rester compatible avec les providers qui ne les publient pas encore.
	 */
	"stopPoints?": stopPointSchema.array(),
	/** Identifiant de la configuration du provider (ex. « rouen »), adresse du canal de demande. */
	providerId: "string",
	sourceId: "string",
	/** Lignes desservant la station, sous la forme `${networkRef}:Line:${lineRef}`. */
	lineRefs: "string[]",
	updatedAt: "string.date.iso",
});

export type StopAreaManifest = typeof stopAreaManifestSchema.infer;

export const stopDeparturesRequestSchema = type({
	requestId: "string",
	stopAreaRef: "string",
	/** Source détentrice de la station, au sein du provider auquel la demande est adressée. */
	"sourceId?": "string",
	/** Restreint le tableau à un quai de la station, avant la limite du nombre de passages. */
	"stopRef?": "string",
});

export type StopDeparturesRequest = typeof stopDeparturesRequestSchema.infer;

/**
 * Passage à venir à une station, tel que le provider le calcule : horaire théorique du GTFS, corrigé
 * du temps réel lorsque la course en porte.
 */
export const stopDepartureSchema = type({
	stopRef: "string",
	stopName: "string",
	"platformName?": "string",
	lineRef: "string",
	"destination?": "string",
	aimedTime: "string.date.iso",
	"expectedTime?": "string.date.iso",
	callStatus: vehicleJourneyCallStatusEnum,
	/** Vrai lorsque la station est le terminus de départ de la course : le passage y est un départ. */
	"origin?": "boolean",
	/**
	 * Identifiant sous lequel la course serait publiée si elle circulait : permet au client de
	 * rejoindre le véhicule sur la carte lorsqu'il y est effectivement suivi.
	 */
	"journeyId?": "string",
	/** Course théorique dont ce passage est issu, sous la forme `${networkRef}:ServiceJourney:${ref}`. */
	"journeyRef?": "string",
	/** Date de service de la course : une même course circule à plusieurs dates. */
	"serviceDate?": "string.date",
});

export type StopDeparture = typeof stopDepartureSchema.infer;

/**
 * Manière de juger qu'un véhicule a quitté la station :
 * - `SCHEDULE` : dès que son heure de départ (temps réel, sinon théorique) est dépassée ;
 * - `VEHICLE` : seulement lorsque le véhicule associé l'a dépassée d'après la séquence ou l'arrêt
 *   courant de sa position. Tant qu'il ne l'a pas atteinte, il reste annoncé, heure dépassée ou non.
 */
export const passedCallDetectionEnum = type("'SCHEDULE'|'VEHICLE'");
export type PassedCallDetection = typeof passedCallDetectionEnum.infer;

export const stopDeparturesReplySchema = type({
	requestId: "string",
	stopAreaRef: "string",
	departures: stopDepartureSchema.array(),
	/** Absent : `SCHEDULE`. */
	"passedCallDetection?": passedCallDetectionEnum,
});

export type StopDeparturesReply = typeof stopDeparturesReplySchema.infer;

import type { CallOnDemand, StopAreaMode, StopCallDirection } from "@bus-tracker/contracts";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import type { LngLatBounds } from "react-map-gl/maplibre";

import { client, toSearchParams } from "./client";

/** Quai d'une station : un arrêt physique, avec sa position propre. */
export type StopPoint = {
	ref: string;
	name?: string;
	latitude: number;
	longitude: number;
	platformCode?: string;
	/** Mode le plus lourd qui dessert le quai. Absent : celui de sa station. */
	mode?: StopAreaMode;
	/** Accès au quai en fauteuil roulant. Absent : inconnu. */
	wheelchairBoarding?: boolean;
	lines?: { id: number; networkId: number }[];
};

export type StopMarker = {
	ref: string;
	name: string;
	latitude: number;
	longitude: number;
	lineRefs: string[];
	/** Mode le plus lourd qui dessert la station : il en donne le pictogramme. */
	mode: StopAreaMode;
	/** Réseau principal de la station. */
	networkId: number;
	/** Présents seulement lorsqu'ils ont été demandés, aux zooms les plus forts. */
	stopPoints?: StopPoint[];
};

export type StopDeparture = {
	stopRef: string;
	stopName: string;
	platformName?: string;
	/**
	 * Seule l'identité de la ligne voyage avec le passage : son numéro, ses couleurs et son
	 * pictogramme viennent de `GetNetworkQuery`, gardé en cache.
	 */
	lineId?: number;
	/** Réseau de la ligne, qui n'est pas toujours parmi ceux de la station. */
	lineNetworkId?: number;
	destination?: string;
	/** Provenance de la course, renseignée à l'arrivée. */
	originName?: string;
	/** Code mission de la course, comme dans la pop-up du véhicule. */
	missionCode?: string;
	/** Numéro de la course, là où la source n'a pas de véhicule réel : le numéro de train à la SNCF. */
	journeyNumber?: string;
	/** Accessibilité de la course en fauteuil roulant. Absent : inconnue. */
	wheelchairAccessible?: boolean;
	aimedTime: string;
	expectedTime?: string;
	callStatus: "SCHEDULED" | "UNSCHEDULED" | "SKIPPED";
	/** La course entière est supprimée, et non le seul arrêt : `callStatus` vaut alors `SKIPPED`. */
	canceled?: boolean;
	/**
	 * La règle métier de la source juge la course non honorée (aucun véhicule attitré au-delà d'un
	 * délai après son départ, par exemple) : le passage est affiché comme « potentiellement supprimé ».
	 */
	potentiallyCanceled?: boolean;
	/** Le passage a lieu à un arrêt provisoire, que la course ne dessert pas d'ordinaire. */
	temporary?: boolean;
	relocated?: boolean;
	onDemand?: CallOnDemand;
	/** La course porte au moins un horaire temps réel, même si ce passage n'en a pas. */
	realtime?: boolean;
	/** La station est le terminus de départ de la course : le passage y est annoncé comme un départ. */
	origin?: boolean;
	/** La station est le terminus de la course : le passage y est annoncé comme une arrivée. */
	terminus?: boolean;
	/** Course effectivement suivie par l'application : elle peut être rejointe sur la carte. */
	tracked: boolean;
	/** Le véhicule stationne en ce moment à l'arrêt. */
	atStop: boolean;
	journeyId?: string;
};

export type StopDepartures = {
	stop: {
		ref: string;
		name: string;
		latitude: number;
		longitude: number;
		mode: StopAreaMode;
		networkId: number;
		/** Tous les réseaux qui desservent la station. */
		networkIds: number[];
		/** Le tableau propose aussi les prochaines arrivées. */
		arrivals: boolean;
		stopPoints: StopPoint[];
	};
	/** Quai sur lequel le tableau est restreint, lorsque c'est un quai qui a été demandé. */
	stopPointRef?: string;
	departures: StopDeparture[];
};

/**
 * Arrêts de l'emprise courante. Comme pour les véhicules, les bornes n'entrent pas dans la clé de
 * cache : c'est la couche qui redemande les arrêts quand la carte bouge, sans faire clignoter les
 * marqueurs déjà affichés.
 */
/**
 * Marge ajoutée à l'emprise lorsque les quais sont demandés. Les stations sont cherchées d'après leur
 * barycentre : à fort zoom, celui d'une station peut sortir de l'écran alors que ses quais y sont
 * encore, et ils disparaîtraient avec elle. La marge couvre l'écart entre une station et ses quais —
 * une grande gare routière peut les étaler sur plusieurs centaines de mètres.
 */
const STOP_POINTS_SEARCH_MARGIN_M = 500;

const METERS_PER_DEGREE_OF_LATITUDE = 111_320;

export function searchBounds(bounds: LngLatBounds, withStopPoints: boolean) {
	const southWest = bounds.getSouthWest();
	const northEast = bounds.getNorthEast();
	if (!withStopPoints)
		return { swLat: southWest.lat, swLon: southWest.lng, neLat: northEast.lat, neLon: northEast.lng };

	const latitudeMargin = STOP_POINTS_SEARCH_MARGIN_M / METERS_PER_DEGREE_OF_LATITUDE;
	const middleLatitude = ((southWest.lat + northEast.lat) / 2) * (Math.PI / 180);
	const longitudeMargin = latitudeMargin / Math.max(Math.cos(middleLatitude), 0.01);

	return {
		swLat: southWest.lat - latitudeMargin,
		swLon: southWest.lng - longitudeMargin,
		neLat: northEast.lat + latitudeMargin,
		neLon: northEast.lng + longitudeMargin,
	};
}

export const GetStopMarkersQuery = (
	bounds: LngLatBounds,
	{
		enabled,
		networkId,
		lineIds,
		withStopPoints,
	}: { enabled: boolean; networkId?: number; lineIds?: number[]; withStopPoints: boolean },
	realtime = false,
) =>
	queryOptions({
		enabled: enabled && !realtime,
		placeholderData: keepPreviousData,
		// L'inventaire ne bouge qu'au rythme des ressources GTFS : inutile de le sonder.
		staleTime: 300_000,
		queryKey: ["stops", networkId, lineIds, withStopPoints],
		queryFn: () => {
			const { swLat, swLon, neLat, neLon } = searchBounds(bounds, withStopPoints);
			return client
				.get("/stops/markers", {
					searchParams: toSearchParams(
						{
							swLat: String(Math.max(swLat, -90)),
							swLon: String(Math.max(swLon, -180)),
							neLat: String(Math.min(neLat, 90)),
							neLon: String(Math.min(neLon, 180)),
							networkId: networkId ? String(networkId) : undefined,
							withStopPoints: String(withStopPoints),
						},
						{ lineId: lineIds },
					),
				})
				.then((response) => response.json<{ items: StopMarker[] }>());
		},
	});

/**
 * Prochains départs de l'arrêt, ou, à l'inverse, ses prochaines arrivées — ceux des seules lignes
 * filtrées sur la carte, s'il y en a.
 */
export const GetStopDeparturesQuery = (
	stopRef: string | null,
	direction: StopCallDirection = "departures",
	lineIds?: number[],
	realtime = false,
) =>
	queryOptions({
		enabled: stopRef !== null && !realtime,
		retry: false,
		refetchInterval: realtime ? false : 5_000,
		staleTime: 4_000,
		queryKey: ["stop-departures", stopRef, direction, lineIds],
		queryFn: () =>
			client
				.get(`/stops/${encodeURIComponent(stopRef!)}/departures`, {
					searchParams: toSearchParams({ direction }, { lineId: lineIds }),
				})
				.then((response) => response.json<StopDepartures>()),
	});

export type NearbyPosition = { latitude: number; longitude: number };

export type NearbyDeparture = StopDeparture & {
	stopAreaRef: string;
	stopAreaName: string;
	distance: number;
};

export type NearbyDepartures = { departures: NearbyDeparture[] };

export const GetNearbyDeparturesQuery = (position: NearbyPosition | null, realtime = false) =>
	queryOptions({
		enabled: position !== null && !realtime,
		placeholderData: keepPreviousData,
		retry: false,
		refetchInterval: realtime ? false : 5_000,
		staleTime: 4_000,
		queryKey: ["nearby-departures", position?.latitude, position?.longitude],
		queryFn: () =>
			client
				.get("/stops/nearby", {
					searchParams: toSearchParams({
						latitude: String(position!.latitude),
						longitude: String(position!.longitude),
					}),
				})
				.then((response) => response.json<NearbyDepartures>()),
	});

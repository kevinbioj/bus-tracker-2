import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import type { LngLatBounds } from "react-map-gl/maplibre";

import { client } from "./client";

/** Quai d'une station : un arrêt physique, avec sa position propre. */
export type StopPoint = {
	ref: string;
	latitude: number;
	longitude: number;
	platformCode?: string;
};

export type StopMarker = {
	ref: string;
	name: string;
	latitude: number;
	longitude: number;
	lineRefs: string[];
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
	destination?: string;
	aimedTime: string;
	expectedTime?: string;
	callStatus: "SCHEDULED" | "UNSCHEDULED" | "SKIPPED";
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
		networkId: number;
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

function searchBounds(bounds: LngLatBounds, withStopPoints: boolean) {
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
	{ enabled, networkId, withStopPoints }: { enabled: boolean; networkId?: number; withStopPoints: boolean },
) =>
	queryOptions({
		enabled,
		placeholderData: keepPreviousData,
		// L'inventaire ne bouge qu'au rythme des ressources GTFS : inutile de le sonder.
		staleTime: 300_000,
		queryKey: ["stops", networkId, withStopPoints],
		queryFn: () => {
			const { swLat, swLon, neLat, neLon } = searchBounds(bounds, withStopPoints);
			return client
				.get("/stops/markers", {
					searchParams: {
						swLat: String(Math.max(swLat, -90)),
						swLon: String(Math.max(swLon, -180)),
						neLat: String(Math.min(neLat, 90)),
						neLon: String(Math.min(neLon, 180)),
						networkId: networkId ? String(networkId) : undefined,
						withStopPoints: String(withStopPoints),
					},
				})
				.then((response) => response.json<{ items: StopMarker[] }>());
		},
	});

export const GetStopDeparturesQuery = (stopRef: string | null) =>
	queryOptions({
		enabled: stopRef !== null,
		retry: false,
		refetchInterval: 5_000,
		staleTime: 4_000,
		queryKey: ["stop-departures", stopRef],
		queryFn: () =>
			client
				.get(`/stops/${encodeURIComponent(stopRef!)}/departures`)
				.then((response) => response.json<StopDepartures>()),
	});

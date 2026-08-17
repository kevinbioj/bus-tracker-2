import type { VehicleJourneyPath } from "@bus-tracker/contracts";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import type { LngLatBounds } from "react-map-gl/maplibre";

import { readDisplayedCountryCodes } from "~/components/vehicles-map/displayed-countries";
import { positionTypes, readDisplayedPositionTypes } from "~/components/vehicles-map/displayed-position-types";
import type { GirouetteData } from "~/components/vehicles-map/vehicles-markers/popup/girouette";
import { client } from "./client";
import type { VehicleAirConditioningStatus } from "./vehicles";

export type VehicleJourneyMarker = {
	id: string;
	lineNumber?: string;
	vehicleNumber?: string;
	color?: string;
	fillColor?: string;
	position: { latitude: number; longitude: number; bearing?: number; type: "GPS" | "COMPUTED" };
};

export type DisposeableVehicleJourney = {
	id: string;
	countryCode: string;
	lineId?: number;
	direction?: "OUTBOUND" | "INBOUND";
	destination?: string;
	calls?: Array<{
		aimedTime: string;
		expectedTime?: string;
		stopRef: string;
		stopName: string;
		stopOrder: number;
		latitude?: number;
		longitude?: number;
		platformName?: string;
		distanceTraveled?: number;
		callStatus: "SCHEDULED" | "UNSCHEDULED" | "SKIPPED";
	}>;
	position: {
		latitude: number;
		longitude: number;
		atStop: boolean;
		type: "GPS" | "COMPUTED";
		distanceTraveled?: number;
		recordedAt: string;
	};
	occupancy?: "LOW" | "MEDIUM" | "HIGH" | "NO_PASSENGERS";
	pathRef?: string;
	networkId: number;
	operator?: number;
	line?: { number: string; color?: string; textColor?: string };
	vehicle?: {
		id?: number;
		number: string;
		designation?: string;
		airConditioning?: VehicleAirConditioningStatus;
		usbPorts?: boolean;
	};
	serviceDate?: string;
	girouette?: GirouetteData;
	updatedAt: string;
};

export type VehicleJourneyMarkersFilter = {
	/** Réseau imposé par le mode embarqué : il court-circuite les préférences d'affichage. */
	embeddedNetworkId?: number;
	/** Réseau choisi par l'utilisateur depuis le module de filtre. */
	filteredNetworkId?: number;
	lineId?: number;
};

export const GetVehicleJourneyMarkersQuery = (
	bounds: LngLatBounds,
	{ embeddedNetworkId, filteredNetworkId, lineId }: VehicleJourneyMarkersFilter = {},
) =>
	queryOptions({
		placeholderData: keepPreviousData,
		refetchInterval: 10_000,
		staleTime: 20_000,
		queryKey: ["vehicle-journeys", embeddedNetworkId, filteredNetworkId, lineId],
		queryFn: () => {
			const activeMarkerId = localStorage.getItem("active-feature");
			const networkId = embeddedNetworkId ?? filteredNetworkId;
			// En mode embarqué seulement : les réglages d'affichage de l'utilisateur ne s'appliquent pas.
			const displayedPositionTypes = embeddedNetworkId ? positionTypes : readDisplayedPositionTypes();
			// Le réseau étant imposé, filtrer par pays serait redondant — et masquerait tout si le pays
			// du réseau se trouve décoché dans les préférences.
			const displayedCountryCodes = networkId ? undefined : readDisplayedCountryCodes();

			return client
				.get("/vehicle-journeys/markers", {
					searchParams: {
						swLat: String(Math.max(bounds.getSouthWest().lat, -90)),
						swLon: String(Math.max(bounds.getSouthWest().lng, -180)),
						neLat: String(Math.min(bounds.getNorthEast().lat, 90)),
						neLon: String(Math.min(bounds.getNorthEast().lng, 180)),
						networkId: networkId ? String(networkId) : undefined,
						lineId: lineId ? String(lineId) : undefined,
						positionTypes:
							displayedPositionTypes.length < positionTypes.length ? displayedPositionTypes.join(",") : undefined,
						countryCodes: displayedCountryCodes?.join(","),
						// Ne pas réintroduire de force un véhicule qui n'appartient pas au filtre demandé.
						includeMarker:
							lineId === undefined && filteredNetworkId === undefined ? (activeMarkerId ?? undefined) : undefined,
					},
				})
				.then((response) => response.json<{ items: VehicleJourneyMarker[] }>());
		},
	});

export const GetVehicleJourneyQuery = (id: string | null, refetch?: boolean) =>
	queryOptions({
		enabled: id !== null,
		retry: false,
		refetchInterval: refetch ? 5_000 : undefined,
		staleTime: 10_000,
		queryKey: ["vehicle-journeys", id],
		queryFn: () => client.get(`/vehicle-journeys/${id}`).then((response) => response.json<DisposeableVehicleJourney>()),
	});

export const GetPathQuery = (ref?: string) =>
	queryOptions({
		enabled: ref !== undefined,
		staleTime: 120_000,
		queryKey: ["paths", ref],
		queryFn: () => client.get(`/paths/${ref}`).then((response) => response.json<VehicleJourneyPath>()),
	});

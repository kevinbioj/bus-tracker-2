import type { VehicleJourneyPath } from "@bus-tracker/contracts";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import type { LngLatBounds } from "react-map-gl/maplibre";

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

export const GetVehicleJourneyMarkersQuery = (bounds: LngLatBounds, embeddedNetworkId?: number, lineId?: number) =>
	queryOptions({
		placeholderData: keepPreviousData,
		refetchInterval: 10_000,
		staleTime: 20_000,
		queryKey: ["vehicle-journeys", embeddedNetworkId, lineId],
		queryFn: () => {
			const activeMarkerId = localStorage.getItem("active-feature");
			const displayedPositionTypes = embeddedNetworkId ? positionTypes : readDisplayedPositionTypes();

			return client
				.get("/vehicle-journeys/markers", {
					searchParams: {
						swLat: String(Math.max(bounds.getSouthWest().lat, -90)),
						swLon: String(Math.max(bounds.getSouthWest().lng, -180)),
						neLat: String(Math.min(bounds.getNorthEast().lat, 90)),
						neLon: String(Math.min(bounds.getNorthEast().lng, 180)),
						networkId: embeddedNetworkId ? String(embeddedNetworkId) : undefined,
						lineId: lineId ? String(lineId) : undefined,
						positionTypes:
							displayedPositionTypes.length < positionTypes.length ? displayedPositionTypes.join(",") : undefined,
						includeMarker: lineId === undefined ? (activeMarkerId ?? undefined) : undefined,
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

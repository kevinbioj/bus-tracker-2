import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import type { LngLatBounds } from "react-map-gl/maplibre";

import type { GirouetteData } from "~/components/vehicles-map/vehicles-markers/popup/girouette";

import { client } from "./client";

export type VehicleJourneyMarker = {
	id: string;
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
		platformName?: string;
		callStatus: "SCHEDULED" | "UNSCHEDULED" | "SKIPPED";
	}>;
	position: {
		latitude: number;
		longitude: number;
		atStop: boolean;
		type: "GPS" | "COMPUTED";
		recordedAt: string;
	};
	occupancy?: "LOW" | "MEDIUM" | "HIGH" | "NO_PASSENGERS";
	networkId: number;
	operator?: number;
	vehicle?: { id?: number; number: string; designation?: string };
	serviceDate?: string;
	girouette?: GirouetteData;
	updatedAt: string;
};

export const GetVehicleJourneyMarkersQuery = (bounds: LngLatBounds) =>
	queryOptions({
		placeholderData: keepPreviousData,
		refetchInterval: 10_000,
		staleTime: 20_000,
		queryKey: ["vehicle-journeys"],
		queryFn: () => {
			const activeMarkerId = localStorage.getItem("active-feature");
			const hideScheduledTrips = localStorage.getItem("hide-scheduled-trips") === "true";

			const params = new URLSearchParams();
			params.append("swLat", Math.max(bounds.getSouthWest().lat, -90).toString());
			params.append("swLon", Math.max(bounds.getSouthWest().lng, -180).toString());
			params.append("neLat", Math.min(bounds.getNorthEast().lat, 90).toString());
			params.append("neLon", Math.min(bounds.getNorthEast().lng, 180).toString());
			if (hideScheduledTrips) params.append("excludeScheduled", "true");
			if (activeMarkerId !== null) params.append("includeMarker", activeMarkerId);
			return client
				.get(`vehicle-journeys/markers?${params}`)
				.then((response) => response.json<{ items: VehicleJourneyMarker[] }>());
		},
	});

export const GetVehicleJourneyQuery = (id: string | null, refetch?: boolean) =>
	queryOptions({
		enabled: id !== null,
		placeholderData: keepPreviousData,
		retry: false,
		refetchInterval: refetch ? 5_000 : undefined,
		staleTime: 10_000,
		queryKey: ["vehicle-journeys", id],
		queryFn: () => client.get(`vehicle-journeys/${id}`).then((response) => response.json<DisposeableVehicleJourney>()),
	});

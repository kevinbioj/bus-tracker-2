import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import type { LngLatBounds } from "react-map-gl/maplibre";

import type { GirouetteData } from "~/components/vehicles-map/vehicles-markers/popup/girouette";

import { client } from "./client";

export type VehicleJourneyMarker = {
	id: string;
	color?: string;
	fillColor?: string;
	position: { latitude: number; longitude: number; type: "GPS" | "COMPUTED" };
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

export const GetVehicleJourneyMarkersQuery = (bounds: LngLatBounds) => {
	const activeMarkerId = localStorage.getItem("active-feature");
	const hideScheduledTrips = localStorage.getItem("hide-scheduled-trips") === "true";
	const includeIdfm = localStorage.getItem("include-idfm") === "true";

	return queryOptions({
		placeholderData: keepPreviousData,
		refetchInterval: 10_000,
		staleTime: 20_000,
		queryKey: ["vehicle-journeys", bounds, hideScheduledTrips],
		queryFn: () => {
			const params = new URLSearchParams();
			params.append("swLat", bounds.getSouthWest().lat.toString());
			params.append("swLon", bounds.getSouthWest().lng.toString());
			params.append("neLat", bounds.getNorthEast().lat.toString());
			params.append("neLon", bounds.getNorthEast().lng.toString());
			if (hideScheduledTrips) params.append("excludeScheduled", "true");
			if (includeIdfm) params.append("includeIdfm", "true");
			if (activeMarkerId !== null) params.append("includeMarker", activeMarkerId);
			return client
				.get(`vehicle-journeys/markers?${params}`)
				.then((response) => response.json<{ items: VehicleJourneyMarker[] }>());
		},
	});
};

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

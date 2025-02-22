import { keepPreviousData, queryOptions } from "@tanstack/react-query";

import type { MapBounds } from "~/hooks/use-map-bounds";

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
	vehicle?: { id?: number; number: string };
	serviceDate?: string;
	updatedAt: string;
};

export const GetVehicleJourneyMarkersQuery = (bounds: MapBounds, includeMarker?: string) =>
	queryOptions({
		placeholderData: keepPreviousData,
		refetchInterval: 15_000,
		staleTime: 30_000,
		queryKey: ["vehicle-journeys", bounds],
		queryFn: () => {
			const params = new URLSearchParams();
			params.append("swLat", bounds.sw[0].toString());
			params.append("swLon", bounds.sw[1].toString());
			params.append("neLat", bounds.ne[0].toString());
			params.append("neLon", bounds.ne[1].toString());
			if (typeof includeMarker !== "undefined") {
				params.append("includeMarker", includeMarker);
			}
			return client
				.get(`vehicle-journeys/markers?${params}`)
				.then((response) => response.json<{ items: VehicleJourneyMarker[] }>());
		},
	});

export const GetVehicleJourneyQuery = (id: string, enabled?: boolean) =>
	queryOptions({
		enabled,
		placeholderData: keepPreviousData,
		refetchInterval: 10_000,
		staleTime: 30_000,
		queryKey: ["vehicle-journeys", id],
		queryFn: () => client.get(`vehicle-journeys/${id}`).then((response) => response.json<DisposeableVehicleJourney>()),
	});

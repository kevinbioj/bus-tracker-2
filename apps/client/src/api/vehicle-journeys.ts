import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { useLocalStorage } from "usehooks-ts";

import { GirouetteData } from "~/components/interactive-map/vehicles/girouette";
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

export const GetVehicleJourneyMarkersQuery = (bounds: MapBounds, includeMarker?: string) => {
	const [hideScheduledTrips] = useLocalStorage("hide-scheduled-trips", false);
	const [includeIdfm] = useLocalStorage("include-idfm", false);

	return queryOptions({
		placeholderData: keepPreviousData,
		refetchInterval: 10_000,
		staleTime: 20_000,
		queryKey: ["vehicle-journeys", bounds, hideScheduledTrips],
		queryFn: () => {
			const params = new URLSearchParams();
			params.append("swLat", bounds.sw[0].toString());
			params.append("swLon", bounds.sw[1].toString());
			params.append("neLat", bounds.ne[0].toString());
			params.append("neLon", bounds.ne[1].toString());
			if (hideScheduledTrips) params.append("excludeScheduled", "true");
			if (includeIdfm) params.append("includeIdfm", "true");
			if (typeof includeMarker !== "undefined") {
				params.append("includeMarker", includeMarker);
			}
			return client
				.get(`vehicle-journeys/markers?${params}`)
				.then((response) => response.json<{ items: VehicleJourneyMarker[] }>());
		},
	});
};

export const GetVehicleJourneyQuery = (id: string, enabled?: boolean, refetch?: boolean) =>
	queryOptions({
		enabled,
		placeholderData: keepPreviousData,
		retry: false,
		refetchInterval: refetch ? 5_000 : undefined,
		staleTime: 10_000,
		queryKey: ["vehicle-journeys", id],
		queryFn: () => client.get(`vehicle-journeys/${id}`).then((response) => response.json<DisposeableVehicleJourney>()),
	});

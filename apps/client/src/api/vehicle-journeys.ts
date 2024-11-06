import { keepPreviousData, queryOptions } from "@tanstack/react-query";

import type { MapBounds } from "~/hooks/use-map-bounds.js";

import { client } from "./client.js";

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
		callStatus: "SCHEDULED" | "SKIPPED";
	}>;
	position: {
		latitude: number;
		longitude: number;
		atStop: boolean;
		type: "GPS" | "COMPUTED";
		recordedAt: string;
	};
	networkId: number;
	operator?: number;
	vehicle?: { id?: number; number: string };
	serviceDate?: string;
	updatedAt: string;
};

export const VehicleJourneysQuery = (bounds: MapBounds) =>
	queryOptions({
		placeholderData: keepPreviousData,
		refetchInterval: 5_000,
		queryKey: ["vehicle-journeys", bounds],
		queryFn: () => {
			const params = new URLSearchParams();
			params.append("swLat", bounds.sw[0].toString());
			params.append("swLon", bounds.sw[1].toString());
			params.append("neLat", bounds.ne[0].toString());
			params.append("neLon", bounds.ne[1].toString());
			return client
				.get(`vehicle-journeys?${params}`)
				.then((response) => response.json<{ journeys: DisposeableVehicleJourney[] }>());
		},
	});

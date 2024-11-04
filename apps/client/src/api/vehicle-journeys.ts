import { queryOptions } from "@tanstack/react-query";

import { client } from "./client.js";

export type DisposeableVehicleJourney = {
	id: string;
	line?: { id: number; ref: string; number: string; type: string; color?: string; textColor?: string };
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
	network: { id: number; ref: string; name: string };
	operator?: { id: number; ref: string; name: string };
	vehicleRef?: string;
	serviceDate?: string;
	updatedAt: string;
};

export const VehicleJourneysQuery = queryOptions({
	refetchInterval: 5_000,
	queryKey: ["vehicle-journeys"],
	queryFn: () =>
		client.get("vehicle-journeys").then((response) => response.json<{ journeys: DisposeableVehicleJourney[] }>()),
});

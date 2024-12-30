import type { VehicleJourneyLineType } from "@bus-tracker/contracts";
import { queryOptions } from "@tanstack/react-query";

import { client } from "~/api/client";

export type Vehicle = {
	id: number;
	networkId: number;
	operatorId: number | null;
	ref: string;
	number: string;
	type: VehicleJourneyLineType;
	designation: string | null;
	tcId: number | null;
	archivedAt: string | null;
	activity: VehicleActivity;
};

export type VehicleActivity = { status: "online" | "offline"; since: string; lineId?: number };

export const GetVehiclesQuery = (networkId: number) =>
	queryOptions({
		queryKey: ["network-vehicles", networkId],
		queryFn: () => {
			const params = new URLSearchParams();
			params.append("networkId", networkId.toString());
			return client.get(`vehicles?${params}`).then((response) => response.json<Vehicle[]>());
		},
		select: (data) => data.sort((a, b) => +a.number - +b.number),
		refetchOnWindowFocus: false,
	});

export const GetVehicleQuery = (vehicleId: number) =>
	queryOptions({
		queryKey: ["vehicles", vehicleId],
		queryFn: () => client.get(`vehicles/${vehicleId}`).then((response) => response.json<Vehicle>()),
	});

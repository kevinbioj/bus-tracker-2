import type { VehicleJourneyLineType } from "@bus-tracker/contracts";
import { queryOptions } from "@tanstack/react-query";

import { client } from "~/api/client";
import { Operator } from "~/api/networks";

export type Vehicle = {
	id: number;
	networkId: number;
	operator: Operator | null;
	ref: string;
	number: string;
	type: VehicleJourneyLineType;
	designation: string | null;
	tcId: number | null;
	archivedAt: string | null;
	activity: VehicleActivity;
};

export type VehicleWithActiveMonths = Vehicle & {
	activeMonths: string[];
};

export type VehicleActivity = {
	status: "online" | "offline";
	since: string | null;
	lineId?: number;
	markerId?: string;
	position?: { latitude: number; longitude: number };
};

export type VehicleTimeline = {
	timeline: VehicleTimelineDay[];
};

export type VehicleTimelineDay = {
	date: string;
	activities: VehicleTimelineDayActivity[];
};

export type VehicleTimelineDayActivity = {
	type: "LINE_ACTIVITY";
	lineId: number;
	startedAt: string;
	updatedAt: string;
};

export const GetVehiclesQuery = (networkId?: number) =>
	queryOptions({
		enabled: typeof networkId !== "undefined",
		queryKey: ["network-vehicles", networkId],
		queryFn: () => {
			const params = new URLSearchParams();
			if (typeof networkId === "number") {
				params.append("networkId", networkId.toString());
			}
			return client.get(`vehicles?${params}`).then((response) => response.json<Vehicle[]>());
		},
		select: (data) => data.sort((a, b) => +a.number - +b.number),
		refetchInterval: 20_000,
	});

export const GetVehicleQuery = (vehicleId: number) =>
	queryOptions({
		refetchInterval: 20_000,
		queryKey: ["vehicles", vehicleId],
		queryFn: () => client.get(`vehicles/${vehicleId}`).then((response) => response.json<VehicleWithActiveMonths>()),
	});

export const GetVehicleActivitiesQuery = (vehicleId: number, month?: string) =>
	queryOptions({
		queryKey: ["vehicles", vehicleId, "activities", month],
		queryFn: () => {
			const params = new URLSearchParams();
			if (month) params.append("month", month);
			return client
				.get(`vehicles/${vehicleId}/activities?${params.toString()}`)
				.then((response) => response.json<VehicleTimeline>());
		},
	});

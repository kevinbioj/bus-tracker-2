import { keepPreviousData, queryOptions } from "@tanstack/react-query";

import { client } from "./client";
import type { Vehicle } from "./vehicles";

export type Line = {
	id: number;
	networkId: number;
	references: string[];
	number: string;
	cartridgeHref: string;
	color: string;
	textColor: string;
	archivedAt: string;
	activeMonths: string[];
	latestServiceDate: string | null;
};

export type LineVehicleAssignment = {
	id: number;
	number: string;
	designation: string;
	activities: { startedAt: string; endedAt: string }[];
};

export type LineVehicleAssignmentsResponse = {
	activeDays: string[];
	vehicles: LineVehicleAssignment[];
};

export const GetLineQuery = (lineId?: number) =>
	queryOptions({
		enabled: typeof lineId !== "undefined",
		staleTime: 15_000,
		queryKey: ["lines", lineId],
		queryFn: () => client.get(`lines/${lineId}`).then((response) => response.json<Line>()),
	});

export const GetLineOnlineVehiclesQuery = (lineId?: number) =>
	queryOptions({
		enabled: typeof lineId !== "undefined",
		staleTime: 15_000,
		refetchInterval: 5_000,
		queryKey: ["lines", lineId, "online"],
		queryFn: () => client.get(`lines/${lineId}/online-vehicles`).then((response) => response.json<Vehicle[]>()),
	});

export const GetLineVehicleAssignmentsQuery = (lineId: number, date: string) =>
	queryOptions({
		placeholderData: keepPreviousData,
		staleTime: 10_000,
		refetchInterval: 10_000,
		queryKey: ["lines", lineId, "vehicle-assignments", date],
		structuralSharing: false,
		queryFn: () =>
			client
				.get(`lines/${lineId}/vehicle-assignments?date=${date}`)
				.then((response) => response.json<LineVehicleAssignmentsResponse>()),
	});

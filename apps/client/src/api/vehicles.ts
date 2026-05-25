import type { VehicleJourneyLineType } from "@bus-tracker/contracts";
import { mutationOptions, queryOptions } from "@tanstack/react-query";

import { client } from "~/api/client";
import { getLegacyEditorToken } from "~/api/editors";
import type { Operator } from "~/api/networks";

export const vehicleArchiveReasons = ["FAILURE", "FIRE", "RETIRED", "SOLD", "TRANSFER", "OTHER"] as const;
export type VehicleArchiveReason = (typeof vehicleArchiveReasons)[number];

export const vehicleAirConditioningStatuses = ["PRESENT", "OUT_OF_SERVICE", "ABSENT"] as const;
export type VehicleAirConditioningStatus = (typeof vehicleAirConditioningStatuses)[number];

export type Vehicle = {
	id: number;
	networkId: number;
	operatorId: number | null;
	operator: Operator | null;
	ref: string;
	number: string;
	type: VehicleJourneyLineType;
	designation: string | null;
	tcId: number | null;
	airConditioning: VehicleAirConditioningStatus | null;
	usbPorts: boolean | null;
	archivedAt: string | null;
	archivedFor: VehicleArchiveReason | null;
	activity: VehicleActivity;
};

export type UpdateVehicleData = {
	number: string;
	designation: string | null;
	tcId: number | null;
	type: VehicleJourneyLineType;
	operatorId: number | null;
	airConditioning: VehicleAirConditioningStatus | null;
	usbPorts: boolean | null;
};

export type ArchiveVehicleData = {
	reason: VehicleArchiveReason | null;
	wipeReference: boolean;
	archivedAt?: string | null;
};

export type VehicleReportData = {
	field: "airConditioning";
	value: Extract<VehicleAirConditioningStatus, "PRESENT" | "OUT_OF_SERVICE">;
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

function getLegacyEditorHeaders() {
	const token = getLegacyEditorToken();
	return token === null ? undefined : { "X-Editor-Token": token };
}

export const GetVehiclesQuery = (networkId?: number) =>
	queryOptions({
		enabled: networkId !== undefined,
		queryKey: ["network-vehicles", networkId],
		queryFn: () =>
			client
				.get("/vehicles", { searchParams: { networkId: networkId ? String(networkId) : undefined } })
				.then((response) => response.json<Vehicle[]>()),
		select: (data) => data.sort((a, b) => +a.number - +b.number),
		refetchInterval: 20_000,
	});

export const GetVehicleQuery = (vehicleId: number) =>
	queryOptions({
		refetchInterval: 20_000,
		queryKey: ["vehicles", vehicleId],
		queryFn: () => client.get(`/vehicles/${vehicleId}`).then((response) => response.json<VehicleWithActiveMonths>()),
	});

export const GetVehicleActivitiesQuery = (vehicleId: number, month?: string) =>
	queryOptions({
		queryKey: ["vehicles", vehicleId, "activities", month],
		queryFn: () =>
			client
				.get(`/vehicles/${vehicleId}/activities`, { searchParams: { month } })
				.then((response) => response.json<VehicleTimeline>()),
	});

export const UpdateVehicleMutation = (vehicleId: number) =>
	mutationOptions({
		mutationFn: async ({ json }: { json: UpdateVehicleData }) => {
			await client.put(`/vehicles/${vehicleId}`, {
				headers: getLegacyEditorHeaders(),
				json,
			});
		},
	});

export const ArchiveVehicleMutation = (vehicleId: number) =>
	mutationOptions({
		mutationFn: async ({ json }: { json: ArchiveVehicleData }) => {
			await client.post(`/vehicles/${vehicleId}/archive`, {
				headers: getLegacyEditorHeaders(),
				json,
			});
		},
	});

export const UnarchiveVehicleMutation = (vehicleId: number) =>
	mutationOptions({
		mutationFn: async () => {
			await client.post(`/vehicles/${vehicleId}/unarchive`, {
				headers: getLegacyEditorHeaders(),
			});
		},
	});

export const CreateVehicleReportMutation = (vehicleId: number) =>
	mutationOptions({
		mutationFn: ({ json }: { json: VehicleReportData }) =>
			client.post(`/vehicles/${vehicleId}/reports`, { json }).json<{
				status: "applied" | "duplicate" | "recorded";
				reportCount?: number;
				threshold?: number;
			}>(),
	});

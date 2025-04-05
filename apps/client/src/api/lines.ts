import { queryOptions } from "@tanstack/react-query";

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
		queryKey: ["lines", lineId, "online"],
		queryFn: () => client.get(`lines/${lineId}/online-vehicles`).then((response) => response.json<Vehicle[]>()),
	});

import { queryOptions } from "@tanstack/react-query";

import { client } from "~/api/client";

export type Network = {
	id: number;
	ref: string;
	name: string;
	authority: string | null;
	logoHref: string | null;
	darkModeLogoHref: string | null;
	color: string | null;
	textColor: string | null;
	hasVehiclesFeature: boolean;
};

export type Operator = {
	id: number;
	ref: string;
	name: string;
};

export type Line = {
	id: number;
	ref: string;
	number: string;
	cartridgeHref: string | null;
	color: string | null;
	textColor: string | null;
	archivedAt: string | null;
	onlineVehicleCount?: number;
};

export type NetworkWithDetails = Network & {
	operators: Operator[];
	lines: Line[];
};

export type NetworkStats = {
	network: Network;
	ongoingJourneyCount: number;
	onlineVehicleCount: number;
	totalVehicleCount: number;
};

export const GetNetworksQuery = queryOptions({
	queryKey: ["networks"],
	queryFn: () => client.get("networks").then((response) => response.json<Network[]>()),
	select: (networks) =>
		networks
			.map((network) => ({
				...network,
				color: network.color ? `#${network.color}` : null,
				textColor: network.textColor ? `#${network.textColor}` : null,
			}))
			.sort((a, b) => a.name.localeCompare(b.name)),
});

export const GetNetworkQuery = (networkId?: number) =>
	queryOptions({
		enabled: typeof networkId !== "undefined",
		queryKey: ["networks", networkId],
		queryFn: () => client.get(`networks/${networkId}`).then((response) => response.json<NetworkWithDetails>()),
		staleTime: 300_000,
		select: ({ lines, ...network }) => ({
			...network,
			color: network.color ? `#${network.color}` : null,
			textColor: network.textColor ? `#${network.textColor}` : null,
			lines: lines.map((line) => ({
				...line,
				color: line.color ? `#${line.color}` : null,
				textColor: line.textColor ? `#${line.textColor}` : null,
			})),
		}),
	});

export const GetNetworkStatsQuery = (networkId: number) =>
	queryOptions({
		queryKey: ["networks", networkId, "stats"],
		queryFn: () => client.get(`networks/${networkId}/stats`).then((response) => response.json<NetworkStats>()),
	});

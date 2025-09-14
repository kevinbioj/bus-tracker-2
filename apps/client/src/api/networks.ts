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
	regionId: number;
};

export type Operator = {
	id: number;
	ref: string;
	name: string;
	sortOrder: number;
};

export type Line = {
	id: number;
	ref: string;
	number: string;
	girouetteNumber: string | null;
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

export const GetNetworkQuery = <T extends boolean>(networkId?: number, withDetails?: T, continuousRefetch?: boolean) =>
	queryOptions({
		enabled: typeof networkId !== "undefined",
		queryKey: ["networks", networkId, withDetails ?? false],
		queryFn: () =>
			client
				.get(`networks/${networkId}?withDetails=${withDetails ?? false}`)
				.then((response) => response.json<T extends true ? NetworkWithDetails : Network>()),
		staleTime: 300_000,
		refetchInterval: continuousRefetch ? 10_000 : undefined,
		select: (network) => ({
			...network,
			color: network.color ? `#${network.color}` : null,
			textColor: network.textColor ? `#${network.textColor}` : null,
			lines:
				"lines" in network
					? network.lines.map((line) => ({
							...line,
							color: line.color ? `#${line.color}` : null,
							textColor: line.textColor ? `#${line.textColor}` : null,
						}))
					: undefined,
		}),
	});

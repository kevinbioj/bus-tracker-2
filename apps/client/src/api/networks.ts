import { queryOptions } from "@tanstack/react-query";

import { client } from "~/api/client";

export type Network = {
	id: number;
	ref: string;
	name: string;
	authority: string | null;
	logoHref: string | null;
	color: string | null;
	textColor: string | null;
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
};

export type NetworkWithDetails = Network & {
	operators: Operator[];
	lines: Line[];
};

export const GetNetworksQuery = queryOptions({
	queryKey: ["networks"],
	queryFn: () => client.get("networks").then((response) => response.json<Network[]>()),
	select: (networks) =>
		networks.map((network) => ({
			...network,
			color: network.color ? `#${network.color}` : null,
			textColor: network.textColor ? `#${network.textColor}` : null,
		})),
});

export const GetNetworkQuery = (networkId: number) =>
	queryOptions({
		queryKey: ["networks", networkId],
		queryFn: () => client.get(`networks/${networkId}`).then((response) => response.json<NetworkWithDetails>()),
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

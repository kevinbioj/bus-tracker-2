import { queryOptions } from "@tanstack/react-query";

import { client } from "~/api/client";
import type { Network } from "~/api/networks";

export type DataSourceRealtimeEntityType = "TRIP_UPDATES" | "VEHICLE_POSITIONS";

export type DataSourceStaticFeed = {
	href: string;
	lastModified: string | null;
	importedAt?: string;
};

export type DataSourceRealtimeFeed = {
	href: string;
	entityTypes?: DataSourceRealtimeEntityType[];
};

export type DataSource = {
	id: number;
	kind: "GTFS";
	providerId: string;
	sourceId: string;
	networkRefs: string[];
	staticFeed: DataSourceStaticFeed;
	realtimeFeeds: DataSourceRealtimeFeed[];
	authenticated: boolean;
	firstSeenAt: string;
	lastSeenAt: string;
};

export type NetworkDataSources = {
	network: Network;
	sources: DataSource[];
};

export const GetDataSourcesQuery = queryOptions({
	queryKey: ["data-sources"],
	queryFn: () => client.get("/data-sources").then((response) => response.json<NetworkDataSources[]>()),
	staleTime: 300_000,
});

export const GetNetworkDataSourcesQuery = (networkId?: number) =>
	queryOptions({
		enabled: networkId !== undefined,
		queryKey: ["networks", networkId, "data-sources"],
		queryFn: () => client.get(`/networks/${networkId}/data-sources`).then((response) => response.json<DataSource[]>()),
		staleTime: 300_000,
	});

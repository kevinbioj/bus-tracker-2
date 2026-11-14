import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { GetNetworksQuery, type Network } from "~/api/networks";
import { GetRegionsQuery, type Region } from "~/api/regions";
import { useIsCountryDisplayed } from "~/components/vehicles-map/displayed-countries";
import { useOnlyNetworksWithHistory } from "~/hooks/use-only-networks-with-history";
import { searchNetworks } from "~/utils/network-search";
import { getRegionName } from "~/utils/region-name";

export type RegionGroup = {
	region: Region;
	title: string;
	networks: Network[];
};

export type NetworksListView =
	| { kind: "search"; results: Network[]; hiddenMatchCount: number }
	| { kind: "overview"; favorites: Network[]; regions: RegionGroup[]; others: Network[] }
	| { kind: "region"; group: RegionGroup };

export function useNetworksListView(
	searchQuery: string,
	regionId: number | undefined,
	favoriteNetworkIds: Set<number>,
) {
	const { data: regions } = useSuspenseQuery(GetRegionsQuery);
	const { data: allNetworks } = useSuspenseQuery(GetNetworksQuery);
	const isCountryDisplayed = useIsCountryDisplayed();
	const [onlyNetworksWithHistory] = useOnlyNetworksWithHistory();

	const [networks, hiddenNetworks, withoutHistoryCount] = useMemo(() => {
		const countryNetworks = allNetworks.filter((network) => isCountryDisplayed(network.countryCode));
		const withoutHistory = countryNetworks.filter((network) => !network.hasVehiclesFeature);

		return onlyNetworksWithHistory
			? [countryNetworks.filter((network) => network.hasVehiclesFeature), withoutHistory, withoutHistory.length]
			: [countryNetworks, [], withoutHistory.length];
	}, [allNetworks, isCountryDisplayed, onlyNetworksWithHistory]);

	const [regionGroups, otherNetworks] = useMemo<[RegionGroup[], Network[]]>(() => {
		const groups = Map.groupBy(networks, (network) => network.regionId ?? -1);
		const regionGroups = regions.flatMap((region) => {
			const regionNetworks = groups.get(region.id);
			return regionNetworks === undefined ? [] : [{ region, title: getRegionName(region), networks: regionNetworks }];
		});

		return [regionGroups, groups.get(-1) ?? []];
	}, [networks, regions]);

	const view = useMemo<NetworksListView>(() => {
		if (searchQuery.length > 0) {
			return {
				kind: "search",
				results: searchNetworks(networks, searchQuery),
				hiddenMatchCount: hiddenNetworks.length > 0 ? searchNetworks(hiddenNetworks, searchQuery).length : 0,
			};
		}

		const selectedGroup =
			regionGroups.length > 1 ? regionGroups.find((group) => group.region.id === regionId) : undefined;
		if (selectedGroup !== undefined) {
			return { kind: "region", group: selectedGroup };
		}

		return {
			kind: "overview",
			favorites: networks.filter((network) => favoriteNetworkIds.has(network.id)),
			regions: regionGroups,
			others: otherNetworks,
		};
	}, [favoriteNetworkIds, hiddenNetworks, networks, otherNetworks, regionGroups, regionId, searchQuery]);

	return { view, withoutHistoryCount };
}

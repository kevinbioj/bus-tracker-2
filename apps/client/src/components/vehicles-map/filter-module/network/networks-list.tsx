import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon, FilterIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useDebounceValue, useLocalStorage } from "usehooks-ts";

import { GetNetworksQuery, type Network } from "~/api/networks";
import { GetRegionsQuery } from "~/api/regions";
import { Button } from "~/components/ui/button";
import { SheetClose, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { useIsCountryDisplayed } from "~/components/vehicles-map/displayed-countries";
import {
	NetworkInnerList,
	type NetworkListView,
} from "~/components/vehicles-map/filter-module/network/networks-inner-list";
import type { RegionGroup } from "~/components/vehicles-map/filter-module/network/region-card";
import { FilterModuleSearchBar } from "~/components/vehicles-map/filter-module/search-bar";
import * as m from "~/paraglide/messages";
import { cn } from "~/utils/cn";
import { searchNetworks } from "~/utils/network-search";
import { getRegionName } from "~/utils/region-name";

type FilterModuleNetworkListProps = {
	regionKey?: string;
	onRegionKeyChange: (regionKey?: string) => void;
	searchQuery: string;
	onSearchQueryChange: (searchQuery: string) => void;
	onNetworkSelect: (network: Network) => void;
};

export function FilterModuleNetworkList({
	regionKey,
	onRegionKeyChange,
	searchQuery,
	onSearchQueryChange,
	onNetworkSelect,
}: Readonly<FilterModuleNetworkListProps>) {
	const { data: regions } = useQuery(GetRegionsQuery);
	const { data: allNetworks } = useQuery(GetNetworksQuery);
	const isCountryDisplayed = useIsCountryDisplayed();

	// La liste suit le réglage « Pays à afficher » : proposer un réseau dont aucun véhicule ne peut
	// apparaître sur la carte n'aurait pas de sens.
	const networks = useMemo(
		() => allNetworks?.filter((network) => isCountryDisplayed(network.countryCode)),
		[allNetworks, isCountryDisplayed],
	);

	const scrollRef = useRef<HTMLDivElement>(null);
	const [debouncedSearchQuery] = useDebounceValue(searchQuery, 300);

	const [favoriteNetworkIds, setFavoriteNetworkIds] = useLocalStorage("favorite-networks", new Set<number>(), {
		deserializer: (value) => new Set(JSON.parse(value)),
		serializer: (value) => JSON.stringify(Array.from(value.values())),
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: effect runs on query updates
	useEffect(() => {
		scrollRef.current?.scrollTo({ behavior: "smooth", top: 0 });
	}, [searchQuery]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: effect runs on region updates
	useEffect(() => {
		scrollRef.current?.scrollTo({ top: 0 });
	}, [regionKey]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: setters are not dependencies
	const toggleFavoriteNetworkId = useCallback(
		(network: Network) => {
			const updatedSet = new Set(favoriteNetworkIds);

			if (updatedSet.has(network.id)) {
				updatedSet.delete(network.id);
			} else {
				updatedSet.add(network.id);
			}

			setFavoriteNetworkIds(updatedSet);
		},
		[favoriteNetworkIds],
	);

	const favoriteNetworks = useMemo(
		() => networks?.filter((network) => favoriteNetworkIds.has(network.id)) ?? [],
		[favoriteNetworkIds, networks],
	);

	// Une recherche active remplace le classement par région par un classement par pertinence.
	const searchResults = useMemo(() => {
		if (debouncedSearchQuery.trim().length === 0 || networks === undefined) {
			return null;
		}

		return searchNetworks(networks, debouncedSearchQuery);
	}, [debouncedSearchQuery, networks]);

	const [regionGroups, otherNetworks] = useMemo<[RegionGroup[], Network[]]>(() => {
		if (regions === undefined || networks === undefined) {
			return [[], []];
		}

		const groups = Map.groupBy(networks, (network) => network.regionId ?? -1);
		const regionGroups = regions.flatMap((region) => {
			const networks = groups.get(region.id);
			if (networks === undefined) {
				return [];
			}

			return { key: `${region.id}`, title: getRegionName(region), networks };
		});
		return [regionGroups, groups.get(-1) ?? []];
	}, [regions, networks]);

	const selectedRegion = regionGroups.length > 1 ? regionGroups.find((region) => region.key === regionKey) : undefined;

	const view = useMemo<NetworkListView>(() => {
		if (searchResults !== null) return { kind: "search", results: searchResults };
		if (selectedRegion !== undefined) return { kind: "region", region: selectedRegion };
		return { kind: "overview", favorites: favoriteNetworks, regions: regionGroups, others: otherNetworks };
	}, [searchResults, selectedRegion, favoriteNetworks, regionGroups, otherNetworks]);

	const goBackToRegions = () => {
		onRegionKeyChange(undefined);
		onSearchQueryChange("");
	};

	return (
		<div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-none">
			<SheetHeader className="sticky top-0 z-10 shrink-0 gap-0 border-b bg-popover p-0 text-popover-foreground">
				<div className={cn("flex items-center gap-2 py-1.5 pr-1.5", selectedRegion ? "pl-1.5" : "pl-3")}>
					{selectedRegion ? (
						<Button
							aria-label={m.map_region_list_back()}
							className="size-7"
							onClick={goBackToRegions}
							size="icon"
							title={m.map_region_list_back()}
							variant="ghost"
						>
							<ArrowLeftIcon className="size-4" />
						</Button>
					) : (
						<FilterIcon className="size-4 shrink-0 text-muted-foreground" />
					)}
					<SheetTitle className="min-w-0 flex-1 truncate text-sm font-semibold">
						{selectedRegion?.title ?? m.map_network_list_title()}
					</SheetTitle>
					<SheetClose
						render={
							<Button className="size-7" size="icon" title={m.common_close()} variant="ghost">
								<XIcon className="size-4" />
							</Button>
						}
					/>
				</div>
				<div className="px-3 pb-3">
					<FilterModuleSearchBar
						placeholder={m.map_network_search_placeholder()}
						query={searchQuery}
						onQueryChange={onSearchQueryChange}
					/>
				</div>
			</SheetHeader>
			<div className="pt-1">
				<NetworkInnerList
					view={view}
					favoriteNetworkIds={favoriteNetworkIds}
					onNetworkSelect={onNetworkSelect}
					onRegionSelect={(region) => onRegionKeyChange(region.key)}
					toggleFavoriteNetworkId={toggleFavoriteNetworkId}
					scrollRef={scrollRef}
				/>
			</div>
		</div>
	);
}

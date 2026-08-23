import { useQuery } from "@tanstack/react-query";
import { BusFrontIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebounceValue, useLocalStorage } from "usehooks-ts";

import { GetNetworksQuery, type Network } from "~/api/networks";
import { GetRegionsQuery } from "~/api/regions";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet";
import { useIsCountryDisplayed } from "~/components/vehicles-map/displayed-countries";
import { NetworkInnerList } from "~/components/vehicles-map/filter-module/network/networks-inner-list";
import { FilterModuleSearchBar } from "~/components/vehicles-map/filter-module/search-bar";
import * as m from "~/paraglide/messages";
import { searchNetworks } from "~/utils/network-search";

type FilterModuleNetworkListProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onNetworkSelect: (network: Network) => void;
};

export function FilterModuleNetworkList({
	open,
	onOpenChange,
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
	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedSearchQuery] = useDebounceValue(searchQuery, 300);

	const [favoriteNetworkIds, setFavoriteNetworkIds] = useLocalStorage("favorite-networks", new Set<number>(), {
		deserializer: (value) => new Set(JSON.parse(value)),
		serializer: (value) => JSON.stringify(Array.from(value.values())),
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: effect runs on query updates
	useEffect(() => {
		scrollRef.current?.scrollTo({ behavior: "smooth", top: 0 });
	}, [searchQuery]);

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

	const [favoriteNetworks, otherNetworks] = useMemo<[Network[], Network[]]>(() => {
		if (networks === undefined) {
			return [[], []];
		}

		const groups = Map.groupBy(networks, (network) => (favoriteNetworkIds.has(network.id) ? "favorite" : "other"));
		return [groups.get("favorite") ?? [], groups.get("other") ?? []];
	}, [favoriteNetworkIds, networks]);

	// Une recherche active remplace le classement par région par un classement par pertinence.
	const searchResults = useMemo(() => {
		if (debouncedSearchQuery.trim().length === 0 || networks === undefined) {
			return null;
		}

		return searchNetworks(networks, debouncedSearchQuery);
	}, [debouncedSearchQuery, networks]);

	const networksByRegion = useMemo(() => {
		if (regions === undefined) {
			return [];
		}

		const groups = Map.groupBy(otherNetworks, (network) => network.regionId ?? -1);
		const orphanNetworks = groups.get(-1);
		return [
			...regions.flatMap((region) => {
				const networks = groups.get(region.id);
				if (networks === undefined) {
					return [];
				}

				return { title: region.name, networks };
			}),
			...(orphanNetworks !== undefined ? [{ title: m.map_network_other(), networks: orphanNetworks }] : []),
		];
	}, [regions, otherNetworks]);

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetTrigger
				render={
					<button aria-label={m.map_filter_line()} className="leaflet-bar-part leaflet-bar-part-single" type="button">
						<BusFrontIcon className="inline mb-0.5" />
					</button>
				}
			/>
			<SheetContent ref={scrollRef} className="gap-0 z-999 overflow-y-auto overscroll-none">
				<SheetHeader className="bg-popover text-popover-foreground shrink-0 sticky top-0 z-9999">
					<SheetTitle>{m.map_network_list_title()}</SheetTitle>
					<FilterModuleSearchBar
						placeholder={m.map_network_search_placeholder()}
						query={searchQuery}
						onQueryChange={setSearchQuery}
					/>
				</SheetHeader>
				<NetworkInnerList
					favoriteNetworks={favoriteNetworks}
					networksByRegion={networksByRegion}
					searchResults={searchResults}
					favoriteNetworkIds={favoriteNetworkIds}
					onNetworkSelect={onNetworkSelect}
					toggleFavoriteNetworkId={toggleFavoriteNetworkId}
					scrollRef={scrollRef}
				/>
			</SheetContent>
		</Sheet>
	);
}

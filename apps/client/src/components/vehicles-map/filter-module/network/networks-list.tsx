import { useQuery } from "@tanstack/react-query";
import { BusFrontIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebounceValue, useLocalStorage } from "usehooks-ts";

import { GetNetworksQuery, type Network } from "~/api/networks";
import { GetRegionsQuery } from "~/api/regions";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet";
import { NetworkSearchBar } from "~/components/vehicles-map/filter-module/network/network-search-bar";
import { NetworkInnerList } from "~/components/vehicles-map/filter-module/network/networks-inner-list";

const searchifyQuery = (query: string) =>
	query
		.toLowerCase()
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "");

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
	const { data: networks } = useQuery(GetNetworksQuery);

	const scrollRef = useRef<HTMLDivElement>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedSearchifiedSearchQuery] = useDebounceValue(searchifyQuery(searchQuery), 300);

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

		const groups = Map.groupBy(networks, (network) => {
			if (debouncedSearchifiedSearchQuery.length > 0) {
				const compareAgainst = [network.name, ...(network.authority ? [network.authority] : [])].map(searchifyQuery);
				if (compareAgainst.every((value) => !value.includes(debouncedSearchifiedSearchQuery))) {
					return "search-mismatch";
				}
			}

			return favoriteNetworkIds.has(network.id) ? "favorite" : "other";
		});
		return [groups.get("favorite") ?? [], groups.get("other") ?? []];
	}, [debouncedSearchifiedSearchQuery, favoriteNetworkIds, networks]);

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
			...(orphanNetworks !== undefined ? [{ title: "Autres réseaux", networks: orphanNetworks }] : []),
		];
	}, [regions, otherNetworks]);

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetTrigger
				render={
					<button aria-label="Filtrer par ligne" className="leaflet-bar-part leaflet-bar-part-single" type="button">
						<BusFrontIcon className="inline mb-0.5" />
					</button>
				}
			/>
			<SheetContent className="gap-0 h-dvh z-999">
				<SheetHeader className="shrink-0">
					<SheetTitle>Liste des réseaux</SheetTitle>
				</SheetHeader>
				<div className="shrink-0 mb-3">
					<NetworkSearchBar query={searchQuery} onQueryChange={setSearchQuery} />
				</div>
				<NetworkInnerList
					favoriteNetworks={favoriteNetworks}
					networksByRegion={networksByRegion}
					onNetworkSelect={onNetworkSelect}
					toggleFavoriteNetworkId={toggleFavoriteNetworkId}
					scrollRef={scrollRef}
				/>
			</SheetContent>
		</Sheet>
	);
}

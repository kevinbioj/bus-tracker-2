import { useSuspenseQuery } from "@tanstack/react-query";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { StarIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { match, P } from "ts-pattern";
import { useDebounceValue, useLocalStorage } from "usehooks-ts";

import { GetNetworksQuery, type Network } from "~/api/networks";
import { useIsCountryDisplayed } from "~/components/vehicles-map/displayed-countries";
import * as m from "~/paraglide/messages";
import { NetworksListBlock } from "~/routes/_app/data/-networks-list/networks-block";
import {
	ALL_REGIONS_FILTER,
	isSpecialRegionFilter,
	OTHER_REGIONS_FILTER,
	toRegionFilter,
} from "~/routes/_app/data/-networks-list/region-filter";
import { useDisplayedRegions } from "~/routes/_app/data/-networks-list/use-displayed-regions";
import { searchNetworks } from "~/utils/network-search";

type VirtualBlock = {
	key: string;
	title: ReactNode;
	networks: Network[];
};

type NetworksRegionBlock = {
	key: string;
	title: string;
	networks: Network[];
};

export function NetworksListVirtualList() {
	const regions = useDisplayedRegions();
	const { data: networks } = useSuspenseQuery(GetNetworksQuery);

	const listRef = useRef<HTMLDivElement>(null);
	const [searchQuery] = useQueryState("q", parseAsString.withDefault(""));
	const [regionFilterQuery] = useQueryState("region", parseAsString.withDefault(ALL_REGIONS_FILTER));
	const [debouncedSearchQuery] = useDebounceValue(searchQuery.trim(), 300);
	const parsedRegionFilter = toRegionFilter(regionFilterQuery);
	const regionFilter =
		isSpecialRegionFilter(parsedRegionFilter) || regions.some((region) => String(region.id) === parsedRegionFilter)
			? parsedRegionFilter
			: ALL_REGIONS_FILTER;
	const hasSearchQuery = debouncedSearchQuery.length > 0;

	const isCountryDisplayed = useIsCountryDisplayed();
	const [onlyNetworksWithHistory] = useLocalStorage("only-networks-with-history", true);
	const [favoriteNetworkIds] = useLocalStorage("favorite-networks", new Set<number>(), {
		deserializer: (value) => new Set(JSON.parse(value)),
		serializer: (value) => JSON.stringify(Array.from(value.values())),
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: effect runs on query updates
	useEffect(() => {
		window.scrollTo({ behavior: "instant", top: 0 });
	}, [debouncedSearchQuery, regionFilter]);

	const filteredNetworks = useMemo<Network[]>(() => {
		let innerNetworks = networks;
		if (innerNetworks === undefined) {
			return [];
		}

		// Même réglage que la carte : les réseaux des pays masqués n'apparaissent nulle part.
		innerNetworks = innerNetworks.filter((network) => isCountryDisplayed(network.countryCode));

		if (onlyNetworksWithHistory) {
			innerNetworks = innerNetworks.filter((network) => network.hasVehiclesFeature);
		}

		// Les réseaux correspondants sont classés par pertinence : l'ordre est conservé au sein de chaque bloc.
		return searchNetworks(innerNetworks, debouncedSearchQuery);
	}, [debouncedSearchQuery, isCountryDisplayed, networks, onlyNetworksWithHistory]);

	const [favoriteNetworks, regionNetworks] = useMemo<[Network[], Network[]]>(() => {
		if (regionFilter !== ALL_REGIONS_FILTER) {
			return [[], filteredNetworks];
		}

		const groups = Map.groupBy(filteredNetworks, (network) =>
			favoriteNetworkIds.has(network.id) ? "favorite" : "region",
		);
		return [groups.get("favorite") ?? [], groups.get("region") ?? []];
	}, [favoriteNetworkIds, filteredNetworks, regionFilter]);

	const networksByRegion = useMemo<NetworksRegionBlock[]>(() => {
		if (regions === undefined) {
			return [];
		}

		const groups = Map.groupBy(regionNetworks, (network) => network.regionId ?? -1);
		const orphanNetworks = groups.get(-1);
		return [
			...regions.flatMap((region) => {
				const networks = groups.get(region.id);
				if (networks === undefined) {
					return [];
				}

				return {
					key: String(region.id),
					title: region.name,
					networks,
				};
			}),
			...(orphanNetworks !== undefined
				? [{ key: OTHER_REGIONS_FILTER, title: m.map_network_other(), networks: orphanNetworks }]
				: []),
		];
	}, [regions, regionNetworks]);

	const virtualBlocks = useMemo<VirtualBlock[]>(() => {
		const blocks: VirtualBlock[] = [];

		// Une recherche sans filtre de région donne un bloc unique, classé par pertinence : découper par
		// région reléguerait le meilleur résultat au milieu de la page.
		if (hasSearchQuery && regionFilter === ALL_REGIONS_FILTER) {
			return filteredNetworks.length > 0
				? [{ key: "search-results", title: m.networks_list_search_results(), networks: filteredNetworks }]
				: [];
		}

		if (favoriteNetworks.length > 0) {
			blocks.push({
				key: "favorites",
				title: (
					<>
						<StarIcon className="fill-yellow-400 stroke-yellow-600 size-5" /> {m.map_network_favorites()}
					</>
				),
				networks: favoriteNetworks,
			});
		}

		for (const { key, title, networks } of networksByRegion) {
			if (regionFilter !== ALL_REGIONS_FILTER && regionFilter !== key) {
				continue;
			}

			blocks.push({ key: `region-${key}`, title, networks });
		}

		return blocks;
	}, [favoriteNetworks, filteredNetworks, hasSearchQuery, networksByRegion, regionFilter]);

	const virtualizer = useWindowVirtualizer({
		count: virtualBlocks.length,
		initialOffset: 0,
		estimateSize: (index) => {
			const block = virtualBlocks[index];
			const gridCols = match(window.innerWidth)
				.with(P.number.gte(1280), () => 4)
				.with(P.number.gte(1024), () => 3)
				.with(P.number.gte(640), () => 2)
				.otherwise(() => 1);

			const gridLines = Math.ceil(block.networks.length / gridCols);
			return 48 + gridLines * 64 + (gridLines - 1) * 12;
		},
		getItemKey: (index) => virtualBlocks[index].key,
		measureElement: (element) => Math.round(element?.getBoundingClientRect().height ?? 0),
		overscan: 1,
		scrollMargin: listRef.current?.offsetTop ?? 0,
	});

	return (
		<div ref={listRef} className="max-w-(--breakpoint-xl) mx-auto px-3">
			{virtualBlocks.length === 0 && (
				<p className="py-8 text-center text-sm text-muted-foreground">{m.networks_list_empty()}</p>
			)}
			<div className="relative" style={{ height: virtualizer.getTotalSize() }}>
				{virtualizer.getVirtualItems().map((virtualItem) => {
					const block = virtualBlocks[virtualItem.index];
					return (
						<div
							className="absolute py-2 w-full [will-change:transform]"
							data-index={virtualItem.index}
							key={virtualItem.key}
							ref={virtualizer.measureElement}
							style={{ transform: `translateY(${virtualItem.start - virtualizer.options.scrollMargin}px)` }}
						>
							<NetworksListBlock title={block.title} networks={block.networks} />
						</div>
					);
				})}
			</div>
		</div>
	);
}

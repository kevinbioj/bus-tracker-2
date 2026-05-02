import { useSuspenseQuery } from "@tanstack/react-query";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { StarIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { match, P } from "ts-pattern";
import { useDebounceValue, useLocalStorage } from "usehooks-ts";

import { GetNetworksQuery, type Network } from "~/api/networks";
import { GetRegionsQuery } from "~/api/regions";
import { NetworksListBlock } from "~/routes/_app/data/-networks-list/networks-block";

const searchifyQuery = (query: string) =>
	query
		.toLowerCase()
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "");

type VirtualBlock = {
	key: string;
	title: ReactNode;
	networks: Network[];
};

export function NetworksListVirtualList() {
	const { data: regions } = useSuspenseQuery(GetRegionsQuery);
	const { data: networks } = useSuspenseQuery(GetNetworksQuery);

	const listRef = useRef<HTMLDivElement>(null);
	const [searchQuery] = useQueryState("q", parseAsString.withDefault(""));
	const [debouncedSearchifiedSearchQuery] = useDebounceValue(searchifyQuery(searchQuery), 300);

	const [onlyNetworksWithHistory] = useLocalStorage("only-networks-with-history", true);
	const [favoriteNetworkIds] = useLocalStorage("favorite-networks", new Set<number>(), {
		deserializer: (value) => new Set(JSON.parse(value)),
		serializer: (value) => JSON.stringify(Array.from(value.values())),
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: effect runs on query updates
	useEffect(() => {
		window.scrollTo({ behavior: "instant", top: 0 });
	}, [debouncedSearchifiedSearchQuery]);

	const [favoriteNetworks, otherNetworks] = useMemo<[Network[], Network[]]>(() => {
		let innerNetworks = networks;
		if (innerNetworks === undefined) {
			return [[], []];
		}

		if (onlyNetworksWithHistory) {
			innerNetworks = innerNetworks.filter((network) => network.hasVehiclesFeature);
		}

		const groups = Map.groupBy(innerNetworks, (network) => {
			if (debouncedSearchifiedSearchQuery.length > 0) {
				const compareAgainst = [network.name, ...(network.authority ? [network.authority] : [])].map(searchifyQuery);
				if (compareAgainst.every((value) => !value.includes(debouncedSearchifiedSearchQuery))) {
					return "search-mismatch";
				}
			}

			return favoriteNetworkIds.has(network.id) ? "favorite" : "other";
		});
		return [groups.get("favorite") ?? [], groups.get("other") ?? []];
	}, [debouncedSearchifiedSearchQuery, favoriteNetworkIds, networks, onlyNetworksWithHistory]);

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

				return {
					title: region.name,
					networks,
				};
			}),
			...(orphanNetworks !== undefined ? [{ title: "Autres réseaux", networks: orphanNetworks }] : []),
		];
	}, [regions, otherNetworks]);

	const virtualBlocks = useMemo<VirtualBlock[]>(() => {
		const blocks: VirtualBlock[] = [];

		if (favoriteNetworks.length > 0) {
			blocks.push({
				key: "favorites",
				title: (
					<>
						<StarIcon className="fill-yellow-400 stroke-yellow-600 size-5" /> Réseaux favoris
					</>
				),
				networks: favoriteNetworks,
			});
		}

		for (const { title, networks } of networksByRegion) {
			blocks.push({ key: `region-${title}`, title, networks });
		}

		return blocks;
	}, [favoriteNetworks, networksByRegion]);

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
		overscan: 1,
		scrollMargin: listRef.current?.offsetTop ?? 0,
	});

	return (
		<div ref={listRef} className="max-w-(--breakpoint-xl) mx-auto px-3">
			<div className="relative" style={{ height: virtualizer.getTotalSize() }}>
				{virtualizer.getVirtualItems().map((virtualItem) => {
					const block = virtualBlocks[virtualItem.index];
					return (
						<div
							className="absolute py-2 w-full"
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

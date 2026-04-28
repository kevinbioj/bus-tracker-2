import { useSuspenseQuery } from "@tanstack/react-query";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { SearchIcon, StarIcon } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { useDebounceValue, useLocalStorage } from "usehooks-ts";

import { GetNetworksQuery, type Network } from "~/api/networks";
import { GetRegionsQuery } from "~/api/regions";
import { Input } from "~/components/ui/input";
import { NetworksBlock } from "~/pages/network-list/networks-block";

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

export function NetworkList() {
	const { data: regions } = useSuspenseQuery(GetRegionsQuery);
	const { data: networks } = useSuspenseQuery(GetNetworksQuery);

	const listRef = useRef<HTMLDivElement>(null);
	const [searchQuery, setSearchQuery] = useQueryState("q", parseAsString.withDefault(""));
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
		estimateSize: () => 200,
		overscan: 3,
		scrollMargin: listRef.current?.offsetTop ?? 0,
		getItemKey: (index) => virtualBlocks[index].key,
	});

	return (
		<>
			<title>Données – Bus Tracker</title>
			<main className="pb-3 flex flex-col">
				<div className="bg-background sticky pt-3 top-15 z-10">
					<div className="max-w-(--breakpoint-xl) mx-auto px-3">
						<div className="shrink-0 mb-2">
							<h2 className="font-bold text-2xl">Données des véhicules</h2>
							<p className="text-muted-foreground">Sélectionnez un réseau pour consulter ses véhicules et lignes.</p>
						</div>
						<div className="relative shrink-0 mb-3">
							<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
							<Input
								className="pl-9"
								placeholder="Rechercher un réseau ou une ville…"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value || null)}
							/>
						</div>
					</div>
				</div>
				<div ref={listRef} className="flex-1 pb-2 px-3 max-w-(--breakpoint-xl) mx-auto w-full">
					<div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
						{virtualizer.getVirtualItems().map((virtualItem) => {
							const block = virtualBlocks[virtualItem.index];
							return (
								<div
									key={virtualItem.key}
									ref={virtualizer.measureElement}
									data-index={virtualItem.index}
									style={{
										position: "absolute",
										top: 0,
										left: 0,
										width: "100%",
										transform: `translateY(${virtualItem.start - virtualizer.options.scrollMargin}px)`,
									}}
								>
									<NetworksBlock title={block.title} networks={block.networks} />
								</div>
							);
						})}
					</div>
				</div>
			</main>
		</>
	);
}

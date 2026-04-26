import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { BusFrontIcon, SearchIcon, StarIcon } from "lucide-react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocalStorage } from "usehooks-ts";

import { GetNetworksQuery, type Network } from "~/api/networks";
import { GetRegionsQuery } from "~/api/regions";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet";
import { OnlineVehiclesNetworkCard } from "~/components/vehicles-map/online-vehicles/network-selection/online-vehicles-network-card";

function normalizeStr(str: string) {
	return str.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

type FlatItem =
	| { type: "header"; title: string | React.ReactNode; key: string; first: boolean }
	| { type: "card"; network: Network; key: string };

type OnlineVehiclesNetworkSelectionProps = {
	container: HTMLDivElement | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onNetworkSelect: (network: Network) => void;
};

export function OnlineVehiclesNetworkSelection({
	container,
	open,
	onOpenChange,
	onNetworkSelect,
}: Readonly<OnlineVehiclesNetworkSelectionProps>) {
	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetTrigger asChild>
				<a
					aria-label="Véhicules en ligne"
					className="leaflet-bar-part leaflet-bar-part-single"
					// biome-ignore lint/a11y/useValidAnchor: required by Leaflet
					href="#"
				>
					<BusFrontIcon className="inline mb-0.5" />
				</a>
			</SheetTrigger>
			<SheetContent
				aria-describedby={undefined}
				className="max-w-[90vw] w-full p-3 flex flex-col"
				container={container}
			>
				<SheetHeader className="mb-1 shrink-0">
					<SheetTitle className="text-start">Véhicules en ligne</SheetTitle>
				</SheetHeader>
				{open && <NetworkVirtualList onNetworkSelect={onNetworkSelect} />}
			</SheetContent>
		</Sheet>
	);
}

type NetworkVirtualListProps = {
	onNetworkSelect: (network: Network) => void;
};

function NetworkVirtualList({ onNetworkSelect }: NetworkVirtualListProps) {
	const { data: networks } = useQuery(GetNetworksQuery);
	const { data: regions } = useQuery(GetRegionsQuery);

	const [favoriteNetworkIds] = useLocalStorage<number[]>("favorite-networks", []);
	const [onlyNetworksWithHistory] = useLocalStorage("only-networks-with-history", true);
	const [searchQuery, setSearchQuery] = useState("");
	const scrollRef = useRef<HTMLDivElement>(null);

	const normalizedQuery = normalizeStr(searchQuery.trim());
	const matchesSearch = useCallback(
		(network: Network) => {
			if (!normalizedQuery) return true;
			return (
				normalizeStr(network.name).includes(normalizedQuery) ||
				(network.authority !== null && normalizeStr(network.authority).includes(normalizedQuery))
			);
		},
		[normalizedQuery],
	);

	const favoriteNetworks = useMemo(
		() =>
			(networks ?? []).filter(({ id, hasVehiclesFeature }) => {
				if (!favoriteNetworkIds.includes(id)) return false;
				return !onlyNetworksWithHistory || hasVehiclesFeature;
			}),
		[networks, favoriteNetworkIds, onlyNetworksWithHistory],
	);

	const relevantNetworksByRegion = useMemo(
		() =>
			Map.groupBy(
				(networks ?? []).filter(({ hasVehiclesFeature }) => !onlyNetworksWithHistory || hasVehiclesFeature),
				(network) => regions?.find(({ id }) => id === network.regionId) ?? null,
			),
		[networks, regions, onlyNetworksWithHistory],
	);

	const items = useMemo<FlatItem[]>(() => {
		const result: FlatItem[] = [];

		const filteredFavorites = favoriteNetworks.filter(matchesSearch);
		if (filteredFavorites.length > 0) {
			result.push({
				type: "header",
				key: "header-favorites",
				first: true,
				title: (
					<span>
						<StarIcon className="inline align-text-bottom fill-yellow-400 stroke-yellow-600" /> Réseaux favoris
					</span>
				),
			});
			for (const network of filteredFavorites) {
				result.push({ type: "card", network, key: `fav-${network.id}` });
			}
		}

		let isFirst = result.length === 0;
		for (const [region, networks] of Array.from(relevantNetworksByRegion.entries()).toSorted(([a], [b]) => {
			if (a === null) return 1;
			if (b === null) return -1;
			return a.sortOrder - b.sortOrder;
		})) {
			const filtered = networks.filter(matchesSearch);
			if (filtered.length === 0) continue;
			result.push({
				type: "header",
				key: `header-${region?.id ?? -1}`,
				first: isFirst,
				title: region?.name ?? "Autres réseaux",
			});
			isFirst = false;
			for (const network of filtered) {
				result.push({ type: "card", network, key: `card-${network.id}` });
			}
		}

		return result;
	}, [favoriteNetworks, relevantNetworksByRegion, matchesSearch]);

	const virtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: useCallback((i: number) => (items[i]?.type === "header" ? 44 : 72), [items]),
		overscan: 5,
	});

	useLayoutEffect(() => {
		virtualizer.measure();
	}, [virtualizer]);

	return (
		<>
			<div className="relative shrink-0">
				<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
				<Input
					className="pl-9"
					placeholder="Rechercher un réseau…"
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
				/>
			</div>
			<div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0">
				<div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
					{virtualizer.getVirtualItems().map((vItem) => {
						const item = items[vItem.index];
						return (
							<div
								key={item.key}
								data-index={vItem.index}
								ref={virtualizer.measureElement}
								className="absolute top-0 left-0 w-full"
								style={{ transform: `translateY(${vItem.start}px)` }}
							>
								{item.type === "header" ? (
									<div className={item.first ? "pb-3" : "pt-6 pb-3"}>
										<div className="flex items-center gap-3">
											<h3 className="font-semibold whitespace-nowrap text-muted-foreground">{item.title}</h3>
											<Separator className="flex-1" />
										</div>
									</div>
								) : (
									<div className="pb-2">
										<OnlineVehiclesNetworkCard network={item.network} onClick={() => onNetworkSelect(item.network)} />
									</div>
								)}
							</div>
						);
					})}
				</div>
			</div>
		</>
	);
}

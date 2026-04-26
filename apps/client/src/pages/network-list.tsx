import { useSuspenseQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowRight, SearchIcon, StarIcon } from "lucide-react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLocalStorage, useMediaQuery } from "usehooks-ts";

import { GetNetworksQuery, type Network } from "~/api/networks";
import { GetRegionsQuery } from "~/api/regions";
import { Input } from "~/components/ui/input";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/utils/utils";

function normalizeStr(str: string) {
	return str.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

type PageItem =
	| { type: "header"; title: string | React.ReactNode; key: string; first: boolean }
	| { type: "row"; networks: Network[]; key: string; cols: number };

const CARD_HEIGHT = 64;
const ROW_GAP = 12;
const HEADER_HEIGHT_FIRST = 44;
const HEADER_HEIGHT_REST = 68;

export function NetworkList() {
	const { data: regions } = useSuspenseQuery(GetRegionsQuery);
	const { data: networks } = useSuspenseQuery(GetNetworksQuery);

	const [favoriteNetworkIds] = useLocalStorage<number[]>("favorite-networks", []);
	const [onlyNetworksWithHistory] = useLocalStorage("only-networks-with-history", true);
	const [searchQuery, setSearchQuery] = useState("");

	const listRef = useRef<HTMLDivElement>(null);

	const isSm = useMediaQuery("(min-width: 640px)");
	const isMd = useMediaQuery("(min-width: 768px)");
	const isXl = useMediaQuery("(min-width: 1280px)");
	const colCount = isXl ? 4 : isMd ? 3 : isSm ? 2 : 1;

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
			networks.filter(({ id, hasVehiclesFeature }) => {
				if (!favoriteNetworkIds.includes(id)) return false;
				return !onlyNetworksWithHistory || hasVehiclesFeature;
			}),
		[networks, favoriteNetworkIds, onlyNetworksWithHistory],
	);

	const relevantNetworksByRegion = useMemo(
		() =>
			Map.groupBy(
				networks.filter(({ hasVehiclesFeature }) => !onlyNetworksWithHistory || hasVehiclesFeature),
				(network) => regions.find(({ id }) => id === network.regionId) ?? null,
			),
		[networks, regions, onlyNetworksWithHistory],
	);

	const items = useMemo<PageItem[]>(() => {
		const result: PageItem[] = [];

		function pushSection(title: string | React.ReactNode, sectionKey: string, nets: Network[], first: boolean) {
			result.push({ type: "header", title, key: `header-${sectionKey}`, first });
			for (let i = 0; i < nets.length; i += colCount) {
				result.push({
					type: "row",
					networks: nets.slice(i, i + colCount),
					key: `row-${sectionKey}-${i}`,
					cols: colCount,
				});
			}
		}

		const filteredFavorites = favoriteNetworks.filter(matchesSearch);
		if (filteredFavorites.length > 0) {
			pushSection(
				<span>
					<StarIcon className="inline align-text-bottom fill-yellow-400 stroke-yellow-600" /> Réseaux favoris
				</span>,
				"favorites",
				filteredFavorites,
				true,
			);
		}

		let isFirst = result.length === 0;
		for (const [region, nets] of Array.from(relevantNetworksByRegion.entries()).toSorted(([a], [b]) => {
			if (a === null) return 1;
			if (b === null) return -1;
			return a.sortOrder - b.sortOrder;
		})) {
			const filtered = nets.filter(matchesSearch);
			if (filtered.length === 0) continue;
			pushSection(region?.name ?? "Autres réseaux", String(region?.id ?? -1), filtered, isFirst);
			isFirst = false;
		}

		return result;
	}, [favoriteNetworks, relevantNetworksByRegion, matchesSearch, colCount]);

	const virtualizer = useVirtualizer({
		count: items.length,
		getScrollElement: () => listRef.current,
		estimateSize: useCallback(
			(i: number) => {
				const item = items[i];
				if (item?.type === "header") return item.first ? HEADER_HEIGHT_FIRST : HEADER_HEIGHT_REST;
				return CARD_HEIGHT + ROW_GAP;
			},
			[items],
		),
		overscan: 3,
	});

	useLayoutEffect(() => {
		virtualizer.measure();
	}, [virtualizer]);

	return (
		<>
			<title>Données – Bus Tracker</title>
			<main className="p-3 max-w-(--breakpoint-xl) w-full mx-auto h-[calc(100dvh-60px)] flex flex-col gap-6 overflow-hidden">
				<div className="shrink-0">
					<h2 className="font-bold text-2xl">Données des véhicules</h2>
					{onlyNetworksWithHistory && (
						<p className="text-muted-foreground">
							Seuls les réseaux pour lesquels le suivi des véhicules est disponible sont affichés.
						</p>
					)}
				</div>

				<div className="relative shrink-0">
					<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
					<Input
						className="pl-9"
						placeholder="Rechercher un réseau…"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</div>

				<div ref={listRef} className="flex-1 min-h-0 overflow-y-auto">
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
										<div className={cn("flex items-center gap-3", item.first ? "pb-3" : "pt-6 pb-3")}>
											<h3 className="font-semibold text-lg whitespace-nowrap text-muted-foreground">{item.title}</h3>
											<Separator className="flex-1" />
										</div>
									) : (
										<div
											className="grid gap-3 pb-3"
											style={{ gridTemplateColumns: `repeat(${item.cols}, minmax(0, 1fr))` }}
										>
											{item.networks.map((network) => (
												<NetworkCard key={network.id} network={network} />
											))}
										</div>
									)}
								</div>
							);
						})}
					</div>
				</div>
			</main>
		</>
	);
}

function NetworkCard({ network }: { network: Network }) {
	return (
		<Link
			className="flex border justify-between items-center h-16 pr-2 py-2 rounded-lg shadow-md transition-colors text-primary-foreground relative bg-primary/25 hover:bg-primary/50"
			title={network.authority ? `${network.name} – ${network.authority}` : network.name}
			to={`/data/networks/${network.id}`}
			style={{
				backgroundColor: network.color ?? undefined,
				color: network.textColor ?? undefined,
			}}
		>
			<div className="flex-1 overflow-auto text-wrap px-2">
				<h4 className="font-bold text-lg leading-tight">{network.name}</h4>
				{network.authority !== null && <p className="text-xs">{network.authority}</p>}
			</div>
			<ArrowRight />
		</Link>
	);
}

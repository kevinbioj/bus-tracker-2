import { useVirtualizer } from "@tanstack/react-virtual";
import { type ReactNode, type RefObject, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { Network } from "~/api/networks";
import { FavoritesSectionIcon, FilterModuleSectionLabel } from "~/components/vehicles-map/filter-module/list-row";
import { FilterModuleNetworkCard } from "~/components/vehicles-map/filter-module/network/network-card";
import { FilterModuleRegionCard, type RegionGroup } from "~/components/vehicles-map/filter-module/network/region-card";
import * as m from "~/paraglide/messages";

export type NetworkListView =
	| { kind: "search"; results: Network[] }
	| { kind: "overview"; favorites: Network[]; regions: RegionGroup[]; others: Network[] }
	| { kind: "region"; region: RegionGroup };

type VirtualRow =
	| { kind: "separator"; key: string; title: ReactNode; first: boolean }
	| { kind: "network"; key: string; network: Network; isFavorite: boolean }
	| { kind: "region"; key: string; region: RegionGroup }
	| { kind: "no-result"; key: string };

type NetworkInnerListProps = {
	view: NetworkListView;
	favoriteNetworkIds: Set<number>;
	onNetworkSelect: (network: Network) => void;
	onRegionSelect: (region: RegionGroup) => void;
	toggleFavoriteNetworkId: (network: Network) => void;
	scrollRef: RefObject<HTMLDivElement | null>;
};

export function NetworkInnerList({
	view,
	favoriteNetworkIds,
	onNetworkSelect,
	onRegionSelect,
	toggleFavoriteNetworkId,
	scrollRef,
}: NetworkInnerListProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [scrollMargin, setScrollMargin] = useState(0);

	useLayoutEffect(() => {
		setScrollMargin(containerRef.current?.offsetTop ?? 0);
	}, []);

	const virtualRows = useMemo<VirtualRow[]>(() => {
		const rows: VirtualRow[] = [];
		const pushNetworks = (networks: Network[]) => {
			for (const network of networks) {
				rows.push({
					kind: "network",
					key: `net-${network.id}`,
					network,
					isFavorite: favoriteNetworkIds.has(network.id),
				});
			}
		};

		if (view.kind === "search") {
			if (view.results.length === 0) return [{ kind: "no-result", key: "no-result" }];
			rows.push({ kind: "separator", key: "sep-search", title: m.map_network_search_results(), first: true });
			pushNetworks(view.results);
			return rows;
		}

		if (view.kind === "region") {
			rows.push({ kind: "separator", key: `sep-${view.region.key}`, title: view.region.title, first: true });
			pushNetworks(view.region.networks);
			return rows;
		}

		let first = true;
		if (view.favorites.length > 0) {
			rows.push({
				kind: "separator",
				key: "sep-favorites",
				title: (
					<>
						<FavoritesSectionIcon />
						{m.map_network_favorites()}
					</>
				),
				first,
			});
			first = false;
			pushNetworks(view.favorites);
		}

		if (view.regions.length === 1) {
			const [region] = view.regions;
			rows.push({ kind: "separator", key: `sep-${region.key}`, title: region.title, first });
			first = false;
			pushNetworks(region.networks);
		} else if (view.regions.length > 1) {
			rows.push({ kind: "separator", key: "sep-regions", title: m.map_network_regions(), first });
			first = false;
			for (const region of view.regions) rows.push({ kind: "region", key: `region-${region.key}`, region });
		}

		if (view.others.length > 0) {
			rows.push({ kind: "separator", key: "sep-others", title: m.map_network_other(), first });
			pushNetworks(view.others);
		}

		return rows;
	}, [view, favoriteNetworkIds]);

	const virtualizer = useVirtualizer({
		count: virtualRows.length,
		getScrollElement: () => scrollRef.current,
		getItemKey: (index) => virtualRows[index].key,
		estimateSize: (index) => {
			const row = virtualRows[index];
			if (row.kind === "separator") return row.first ? 28 : 40;
			if (row.kind === "no-result") return 80;
			return 56;
		},
		overscan: 5,
		scrollMargin,
	});

	return (
		<div ref={containerRef} className="pb-3">
			<div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
				{virtualizer.getVirtualItems().map((virtualItem) => {
					const row = virtualRows[virtualItem.index];
					return (
						<div
							className="[will-change:transform]"
							key={virtualItem.key}
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								width: "100%",
								height: `${virtualItem.size}px`,
								transform: `translateY(${virtualItem.start - scrollMargin}px)`,
							}}
						>
							{row.kind === "separator" && <FilterModuleSectionLabel>{row.title}</FilterModuleSectionLabel>}
							{row.kind === "no-result" && (
								<p className="text-muted-foreground text-sm text-center px-6 py-6">{m.map_network_search_empty()}</p>
							)}
							{row.kind === "region" && (
								<FilterModuleRegionCard region={row.region} onClick={() => onRegionSelect(row.region)} />
							)}
							{row.kind === "network" && (
								<FilterModuleNetworkCard
									network={row.network}
									isFavorite={row.isFavorite}
									onClick={() => onNetworkSelect(row.network)}
									onToggleFavorite={() => toggleFavoriteNetworkId(row.network)}
								/>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}

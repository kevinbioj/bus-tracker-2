import { useVirtualizer } from "@tanstack/react-virtual";
import { StarIcon } from "lucide-react";
import { type ReactNode, type RefObject, useMemo } from "react";

import type { Network } from "~/api/networks";
import { TitleSeparator } from "~/components/ui/title-separator";
import { FilterModuleNetworkCard } from "~/components/vehicles-map/filter-module/network/network-card";
import { cn } from "~/utils/utils";

type VirtualRow =
	| { kind: "separator"; key: string; title: ReactNode; first: boolean }
	| { kind: "network"; key: string; network: Network; isFavorite: boolean };

type NetworkInnerListProps = {
	favoriteNetworks: Network[];
	networksByRegion: { title: string; networks: Network[] }[];
	onNetworkSelect: (network: Network) => void;
	toggleFavoriteNetworkId: (network: Network) => void;
	scrollRef: RefObject<HTMLDivElement | null>;
};

export function NetworkInnerList({
	favoriteNetworks,
	networksByRegion,
	onNetworkSelect,
	toggleFavoriteNetworkId,
	scrollRef,
}: NetworkInnerListProps) {
	const virtualRows = useMemo<VirtualRow[]>(() => {
		const rows: VirtualRow[] = [];
		let first = true;

		if (favoriteNetworks.length > 0) {
			rows.push({
				kind: "separator",
				key: "sep-favorites",
				title: (
					<>
						<StarIcon className="fill-yellow-400 stroke-yellow-600 size-5" /> Réseaux favoris
					</>
				),
				first,
			});
			first = false;
			for (const network of favoriteNetworks)
				rows.push({ kind: "network", key: `net-${network.id}`, network, isFavorite: true });
		}

		for (const { title, networks } of networksByRegion) {
			rows.push({ kind: "separator", key: `sep-${title}`, title, first });
			first = false;
			for (const network of networks)
				rows.push({ kind: "network", key: `net-${network.id}`, network, isFavorite: false });
		}

		return rows;
	}, [favoriteNetworks, networksByRegion]);

	const virtualizer = useVirtualizer({
		count: virtualRows.length,
		getScrollElement: () => scrollRef.current,
		getItemKey: (index) => virtualRows[index].key,
		estimateSize: (index) => {
			const row = virtualRows[index];
			console.log(row);
			if (row.kind === "separator") return row.first ? 32 : 44;
			return 72; // py-1 (8px) + h-16 (64px)
		},
		overscan: 5,
	});

	return (
		<div className="flex-1 min-h-0 overflow-y-auto pb-1" ref={scrollRef}>
			<div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
				{virtualizer.getVirtualItems().map((virtualItem) => {
					const row = virtualRows[virtualItem.index];
					return (
						<div
							key={virtualItem.key}
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								width: "100%",
								height: `${virtualItem.size}px`,
								transform: `translateY(${virtualItem.start}px)`,
							}}
						>
							{row.kind === "separator" && (
								<div className={cn("px-3", !row.first && "pt-3")}>
									<TitleSeparator className="flex items-center gap-2 text-base">{row.title}</TitleSeparator>
								</div>
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

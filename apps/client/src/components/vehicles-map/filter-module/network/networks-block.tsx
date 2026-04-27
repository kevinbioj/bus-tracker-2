import type { ReactNode } from "react";

import type { Network } from "~/api/networks";
import { TitleSeparator } from "~/components/ui/title-separator";
import { FilterModuleNetworkCard } from "~/components/vehicles-map/filter-module/network/network-card";

type FilterModuleNetworksBlockProps = {
	title: ReactNode;
	networks: Network[];
	favoriteBlock?: boolean;
	onSelect: (network: Network) => unknown;
	onToggleFavorite: (network: Network) => unknown;
};

export function FilterModuleNetworksBlock({
	title,
	networks,
	favoriteBlock,
	onSelect,
	onToggleFavorite,
}: FilterModuleNetworksBlockProps) {
	return (
		<div>
			<div className="px-3">
				<TitleSeparator className="flex items-center gap-2 text-base">{title}</TitleSeparator>
			</div>
			<ul className="mt-2 flex flex-col">
				{networks.map((network) => (
					<li key={network.id}>
						<FilterModuleNetworkCard
							key={network.id}
							network={network}
							isFavorite={favoriteBlock ?? false}
							onClick={() => onSelect(network)}
							onToggleFavorite={() => onToggleFavorite(network)}
						/>
					</li>
				))}
			</ul>
		</div>
	);
}

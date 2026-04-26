import type { ReactNode } from "react";

import type { Network } from "~/api/networks";
import { TitleSeparator } from "~/components/ui/title-separator";
import { OnlineVehiclesNetworkCard } from "~/components/vehicles-map/online-vehicles/network-selection/online-vehicles-network-card";

type NetworksBlockProps = {
	title: ReactNode;
	networks: Network[];
	favoriteBlock?: boolean;
	onSelect: (network: Network) => unknown;
	onToggleFavorite: (network: Network) => unknown;
};

export function NetworksBlock({ title, networks, favoriteBlock, onSelect, onToggleFavorite }: NetworksBlockProps) {
	return (
		<div>
			<TitleSeparator className="flex items-center gap-2">{title}</TitleSeparator>
			<ul className="mt-2 flex flex-col gap-2">
				{networks.map((network) => (
					<li key={network.id}>
						<OnlineVehiclesNetworkCard
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

import type { Network } from "~/api/networks";
import { FilterModuleListRow } from "~/components/vehicles-map/filter-module/list-row";
import { NetworkLogoTile } from "~/components/vehicles-map/filter-module/network/network-logo";

type FilterModuleNetworkCardProps = {
	network: Network;
	isFavorite: boolean;
	onClick: () => void;
	onToggleFavorite: () => void;
};

export function FilterModuleNetworkCard({
	network,
	isFavorite,
	onClick,
	onToggleFavorite,
}: Readonly<FilterModuleNetworkCardProps>) {
	return (
		<FilterModuleListRow
			favoriteName={network.name}
			isFavorite={isFavorite}
			label={network.authority !== null ? `${network.name}, ${network.authority}` : network.name}
			onSelect={onClick}
			onToggleFavorite={onToggleFavorite}
		>
			<NetworkLogoTile className="h-10 w-16" network={network} />
			<span className="grid min-w-0 flex-1 gap-0.5">
				<span className="truncate text-sm font-semibold leading-tight">{network.name}</span>
				{network.authority !== null && (
					<span className="truncate text-xs leading-tight text-muted-foreground">{network.authority}</span>
				)}
			</span>
		</FilterModuleListRow>
	);
}

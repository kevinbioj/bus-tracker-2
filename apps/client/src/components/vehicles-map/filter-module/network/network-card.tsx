import { ArrowRight, StarIcon } from "lucide-react";

import type { Network } from "~/api/networks";
import { Button } from "~/components/ui/button";

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
		<div className="card-item py-1 px-3 relative w-full">
			<Button
				className="absolute top-4.5 left-4.5 z-10 favorite-network-background"
				onClick={onToggleFavorite}
				size="icon"
				variant="ghost"
			>
				{isFavorite ? <StarIcon className="fill-yellow-400 stroke-yellow-600" /> : <StarIcon />}
			</Button>
			<Button
				className="h-16 border drop-shadow-sm flex justify-between items-center pr-4 pl-10 py-2 rounded-lg transition-colors w-full relative overflow-hidden bg-primary/25 text-neutral-800 dark:text-neutral-200 hover:text-primary-foreground card-network-background"
				onClick={onClick}
			>
				<div className="flex-1 overflow-auto text-start text-wrap px-2">
					<h3 className="font-bold text-lg leading-tight">{network.name}</h3>
					{network.authority !== null && <p className="text-xs">{network.authority}</p>}
				</div>
				<ArrowRight />
			</Button>
		</div>
	);
}

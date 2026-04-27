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
		<div className="h-16 relative w-full" key={network.id}>
			{network.color && (
				<style>
					{`@scope {
					.favorite-network-background:hover {
						background-color: ${network.color}33;
					}

					.card-network-background:hover {
						background-color: ${network.color}44 !important;
					}
				}`}
				</style>
			)}
			<Button
				className="absolute top-3.5 left-1.5 z-10 favorite-network-background"
				onClick={onToggleFavorite}
				size="icon"
				variant="ghost"
			>
				{isFavorite ? <StarIcon className="fill-yellow-400 stroke-yellow-600" /> : <StarIcon />}
			</Button>
			<Button
				className="border drop-shadow-md flex justify-between items-center h-16 pr-4 pl-10 py-2 rounded-lg shadow-md transition-colors w-full relative overflow-hidden bg-primary/25 text-neutral-800 dark:text-neutral-200 hover:text-primary-foreground card-network-background"
				onClick={onClick}
				style={{
					backgroundColor: network.color ? `${network.color}33` : undefined,
					borderColor: network.color ?? undefined,
				}}
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

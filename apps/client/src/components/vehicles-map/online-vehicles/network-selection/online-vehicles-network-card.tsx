import { ArrowRight, StarIcon } from "lucide-react";

import type { Network } from "~/api/networks";
import { Button } from "~/components/ui/button";
import { cn } from "~/utils/utils";

type OnlineVehiclesNetworkCard = {
	network: Network;
	isFavorite: boolean;
	isNew?: boolean;
	onClick: () => void;
	onToggleFavorite: () => void;
};

export function OnlineVehiclesNetworkCard({
	network,
	isFavorite,
	isNew = false,
	onClick,
	onToggleFavorite,
}: Readonly<OnlineVehiclesNetworkCard>) {
	return (
		<div
			className={cn("h-16 relative w-full", isNew && "animate-in slide-in-from-bottom-6 fade-in duration-300")}
			key={network.id}
		>
			<Button className="absolute top-3.5 left-1 z-10" onClick={onToggleFavorite} size="icon" variant="ghost">
				{isFavorite ? <StarIcon className="fill-yellow-400 stroke-yellow-600" /> : <StarIcon />}
			</Button>
			<Button
				className="border border-border drop-shadow-mdflex justify-between items-center h-16 pr-4 pl-12 py-2 rounded-lg shadow-md transition-colors w-full relative overflow-hidden bg-primary/25 text-neutral-800 dark:text-neutral-200 hover:text-primary-foreground hover:bg-primary/50"
				onClick={onClick}
			>
				<div className="flex-1 overflow-auto text-start text-wrap px-2">
					<h3 className="font-bold text-lg leading-tight">{network.name}</h3>
					{network.authority !== null && <p className="text-xs">{network.authority}</p>}
				</div>{" "}
				<ArrowRight />
			</Button>
		</div>
	);
}

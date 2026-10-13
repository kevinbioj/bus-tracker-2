import { ArrowRight, StarIcon } from "lucide-react";

import type { Network } from "~/api/networks";
import { Button } from "~/components/ui/button";
import * as m from "~/paraglide/messages";

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
		<div
			className="py-1 px-3 relative w-full"
			key={network.id}
			style={network.color ? ({ "--network-color": network.color } as React.CSSProperties) : undefined}
		>
			<Button
				aria-label={m.map_favorite_toggle({ name: network.name })}
				aria-pressed={isFavorite}
				className="absolute top-4.5 left-4.5 z-10 favorite-network-background"
				onClick={onToggleFavorite}
				size="icon"
				variant="ghost"
			>
				{isFavorite ? <StarIcon className="fill-yellow-400 stroke-yellow-600" /> : <StarIcon />}
			</Button>
			<Button
				aria-label={network.authority !== null ? `${network.name}, ${network.authority}` : network.name}
				className="h-16 border drop-shadow-sm flex justify-between items-center pr-4 pl-10 py-2 rounded-lg transition-colors w-full relative overflow-hidden bg-accent text-accent-foreground hover:bg-accent/70 dark:text-neutral-200 card-network-background"
				style={{
					backgroundColor: network.color ? `${network.color}33` : undefined,
					borderColor: network.color ?? undefined,
				}}
				onClick={onClick}
			>
				<div aria-hidden="true" className="flex-1 overflow-auto text-start text-wrap px-2">
					<p className="font-bold text-lg leading-tight">{network.name}</p>
					{network.authority !== null && <p className="text-xs">{network.authority}</p>}
				</div>
				<ArrowRight />
			</Button>
		</div>
	);
}

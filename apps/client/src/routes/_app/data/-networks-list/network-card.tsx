import { Link } from "@tanstack/react-router";
import { ChevronRightIcon, StarIcon } from "lucide-react";

import type { Network } from "~/api/networks";
import * as m from "~/paraglide/messages";
import { NetworkLogo } from "~/routes/_app/data/-components/network-logo";
import { cardClassName } from "~/routes/_app/data/-networks-list/card-list";
import { cn } from "~/utils/cn";

type NetworksListCardProps = {
	network: Network;
	isFavorite: boolean;
	onToggleFavorite: () => void;
};

export function NetworksListCard({ network, isFavorite, onToggleFavorite }: Readonly<NetworksListCardProps>) {
	const withoutHistory = !network.hasVehiclesFeature;
	const label = [network.name, network.authority, withoutHistory ? m.networks_list_without_history() : null]
		.filter((part) => part !== null)
		.join(", ");

	return (
		<div className="relative">
			<Link
				aria-label={label}
				className={cn(cardClassName, "flex h-14 items-center gap-3 pr-3 pl-2 sm:h-16")}
				params={{ networkId: String(network.id) }}
				to="/data/networks/$networkId"
			>
				<span
					aria-hidden="true"
					className={cn("flex min-w-0 flex-1 items-center gap-3", withoutHistory && "opacity-60")}
				>
					<NetworkLogo className="h-10 w-16 sm:h-11 sm:w-18" network={network} />
					<span className="grid min-w-0 flex-1 gap-0.5">
						<span className="truncate font-semibold leading-tight">{network.name}</span>
						{network.authority !== null && (
							<span className="truncate text-xs leading-tight text-muted-foreground">{network.authority}</span>
						)}
					</span>
				</span>
				<span aria-hidden="true" className="size-8 shrink-0" />
				<ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
			</Link>
			<button
				aria-label={m.map_favorite_toggle({ name: network.name })}
				aria-pressed={isFavorite}
				className={cn(
					"absolute top-1/2 right-8 flex size-8 -translate-y-1/2 items-center justify-center rounded-md transition-colors outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-branding/50",
					isFavorite ? "text-yellow-600" : "text-muted-foreground/60 hover:text-foreground",
				)}
				onClick={onToggleFavorite}
				type="button"
			>
				<StarIcon className={cn("size-4", isFavorite && "fill-yellow-400 stroke-yellow-600")} />
			</button>
		</div>
	);
}

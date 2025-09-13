import { ArrowRight, StarIcon } from "lucide-react";
import { useLocalStorage } from "usehooks-ts";

import type { Network } from "~/api/networks";
import { Button } from "~/components/ui/button";
import { cn } from "~/utils/utils";

type OnlineVehiclesNetworkCard = {
	network: Network;
	onClick: () => void;
};

export function OnlineVehiclesNetworkCard({ network, onClick }: OnlineVehiclesNetworkCard) {
	const [favoriteNetworkIds, setFavoriteNetworkIds] = useLocalStorage<number[]>("favorite-networks", []);

	const toggleFavoriteNetwork = () => {
		if (favoriteNetworkIds.includes(network.id)) {
			setFavoriteNetworkIds(favoriteNetworkIds.filter((id) => id !== network.id));
		} else {
			setFavoriteNetworkIds([...favoriteNetworkIds, network.id]);
		}
	};

	return (
		<div className="h-16 relative w-full" key={network.id}>
			<Button className="absolute top-3.5 left-1 z-10" onClick={toggleFavoriteNetwork} size="icon" variant="ghost">
				{favoriteNetworkIds.includes(network.id) ? (
					<StarIcon className="fill-yellow-400 stroke-yellow-600" />
				) : (
					<StarIcon />
				)}
			</Button>
			<Button
				className="border border-border  drop-shadow-mdflex justify-between items-center h-16 pr-4 pl-12 py-2 rounded-lg shadow-md transition-colors w-full relative overflow-hidden bg-primary/25 text-neutral-800 dark:text-neutral-200 hover:text-primary-foreground hover:bg-primary/50"
				onClick={onClick}
			>
				<div className="flex-1 text-center overflow-auto text-wrap px-2">
					<h3 className="font-bold text-lg leading-tight">{network.name}</h3>
					{network.authority !== null && <p className="text-xs">{network.authority}</p>}
				</div>{" "}
				<ArrowRight />
				{network.logoHref && (
					<>
						<span
							className={cn(
								"absolute inset-2 -z-10 bg-center bg-no-repeat bg-contain blur-xs",
								network.darkModeLogoHref && "dark:hidden",
							)}
							style={{ backgroundImage: `url("${network.logoHref}")` }}
						/>
						{network.darkModeLogoHref && (
							<span
								className="absolute inset-2 -z-10 bg-center bg-no-repeat bg-contain blur-xs dark:block"
								style={{ backgroundImage: `url("${network.darkModeLogoHref}")` }}
							/>
						)}
					</>
				)}
			</Button>
		</div>
	);
}

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, StarIcon } from "lucide-react";
import { useLocalStorage } from "usehooks-ts";

import { GetNetworksQuery, type Network } from "~/api/networks";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";

type OnlineNetworksProps = {
	updateNetwork: (networkId: number) => void;
};

export function OnlineNetworks({ updateNetwork }: Readonly<OnlineNetworksProps>) {
	const { data: networks } = useQuery(GetNetworksQuery);
	const [favoriteNetworkIds, setFavoriteNetworkIds] = useLocalStorage<number[]>("favorite-networks", []);
	if (!networks) return null;

	const favoriteNetworks = networks.filter(
		({ id, hasVehiclesFeature }) => hasVehiclesFeature && favoriteNetworkIds.includes(id),
	);
	const otherNetworks = networks.filter(
		({ id, hasVehiclesFeature }) => hasVehiclesFeature && !favoriteNetworkIds.includes(id),
	);

	const toggleFavoriteNetwork = (networkId: number) => {
		if (favoriteNetworkIds.includes(networkId)) {
			setFavoriteNetworkIds((favoriteNetworkIds) => favoriteNetworkIds.filter((id) => id !== networkId));
		} else {
			setFavoriteNetworkIds((favoriteNetworkIds) => [...favoriteNetworkIds, networkId]);
		}
	};

	const renderNetwork = (network: Network) => {
		const isFavorite = favoriteNetworkIds.includes(network.id);

		return (
			<div className="h-16 relative w-full" key={network.id}>
				<Button
					className="absolute top-3.5 left-1"
					onClick={() => toggleFavoriteNetwork(network.id)}
					size="icon"
					variant="ghost"
				>
					{isFavorite ? <StarIcon className="fill-yellow-400 stroke-yellow-600" /> : <StarIcon />}
				</Button>
				<Button
					className="border border-border flex justify-between items-center h-16 pr-4 pl-12 py-2 rounded-lg shadow-md transition-colors w-full bg-primary hover:bg-primary/70 text-primary-foreground"
					onClick={() => updateNetwork(network.id)}
					style={{
						backgroundColor: network.color ?? undefined,
						color: network.textColor ?? undefined,
					}}
				>
					{network.logoHref ? (
						<div className="h-full w-full">
							<picture>
								{network.darkModeLogoHref !== null ? (
									<source srcSet={network.darkModeLogoHref} media="(prefers-color-scheme: dark)" />
								) : null}
								<img className="h-full object-contain mx-auto" src={network.logoHref} alt="" />
							</picture>
						</div>
					) : (
						<h3 className="font-bold text-center text-xl w-full">{network.name}</h3>
					)}
					<ArrowRight />
				</Button>
			</div>
		);
	};

	return (
		<div className="flex flex-col gap-4">
			{favoriteNetworks.length > 0 ? (
				<>
					{favoriteNetworks.map(renderNetwork)}
					<Separator />
				</>
			) : null}
			{otherNetworks.map(renderNetwork)}
		</div>
	);
}

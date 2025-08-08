import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { ArrowRight, StarIcon } from "lucide-react";
import { useLocalStorage } from "usehooks-ts";

import { GetNetworksQuery, type Network } from "~/api/networks";
import { GetRegionsQuery } from "~/api/regions";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { Button } from "~/components/ui/button";

type OnlineNetworksProps = {
	updateNetwork: (networkId: number) => void;
};

export function OnlineNetworks({ updateNetwork }: Readonly<OnlineNetworksProps>) {
	const { data: regions } = useQuery(GetRegionsQuery);
	const { data: networks } = useQuery(GetNetworksQuery);

	const [favoriteNetworkIds, setFavoriteNetworkIds] = useLocalStorage<number[]>("favorite-networks", []);

	if (!regions || !networks) return null;

	const favoriteNetworks = networks.filter(
		({ id, hasVehiclesFeature }) => hasVehiclesFeature && favoriteNetworkIds.includes(id),
	);

	const relevantNetworksByRegion = Map.groupBy(
		networks.filter(({ hasVehiclesFeature }) => hasVehiclesFeature),
		(network) => regions.find(({ id }) => id === network.regionId) ?? null,
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
					className="absolute top-3.5 left-1 z-10"
					onClick={() => toggleFavoriteNetwork(network.id)}
					size="icon"
					variant="ghost"
				>
					{isFavorite ? <StarIcon className="fill-yellow-400 stroke-yellow-600" /> : <StarIcon />}
				</Button>
				<Button
					className="border border-border  drop-shadow-mdflex justify-between items-center h-16 pr-4 pl-12 py-2 rounded-lg shadow-md transition-colors w-full relative overflow-hidden bg-primary/30 text-neutral-800 dark:text-neutral-200 hover:text-primary-foreground hover:bg-primary/10"
					onClick={() => updateNetwork(network.id)}
				>
					<h3 className="flex-1 font-bold text-center text-lg overflow-auto text-wrap">{network.name}</h3>
					<ArrowRight />
					{network.logoHref && (
						<>
							<span
								className={clsx(
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
	};

	return (
		<div>
			<div className="space-y-2">{favoriteNetworks.map(renderNetwork)}</div>
			<Accordion className="mt-2" type="multiple">
				{regions
					.filter((region) => relevantNetworksByRegion.get(region)?.length)
					.map((region) => (
						<AccordionItem key={region.id} value={region.id.toString()}>
							<AccordionTrigger>{region.name}</AccordionTrigger>
							<AccordionContent className="space-y-2">
								{relevantNetworksByRegion.get(region)?.map(renderNetwork)}
							</AccordionContent>
						</AccordionItem>
					))}
			</Accordion>
		</div>
	);
}

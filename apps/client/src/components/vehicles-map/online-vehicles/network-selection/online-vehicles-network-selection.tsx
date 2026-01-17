import { useQuery } from "@tanstack/react-query";
import { BusFrontIcon } from "lucide-react";
import { useMemo } from "react";
import { useLocalStorage } from "usehooks-ts";

import { GetNetworksQuery, type Network } from "~/api/networks";
import { GetRegionsQuery } from "~/api/regions";
import { OnlineVehiclesNetworkCard } from "~/components/vehicles-map/online-vehicles/network-selection/online-vehicles-network-card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet";

type OnlineVehiclesNetworkSelection = {
	container: HTMLDivElement | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onNetworkSelect: (network: Network) => void;
};

export function OnlineVehiclesNetworkSelection({
	container,
	open,
	onOpenChange,
	onNetworkSelect,
}: OnlineVehiclesNetworkSelection) {
	const { data: networks } = useQuery(GetNetworksQuery);
	const { data: regions } = useQuery(GetRegionsQuery);

	const networksByRegion = useMemo(() => Map.groupBy(networks ?? [], (network) => network.regionId), [networks]);

	const [favoriteNetworkIds] = useLocalStorage<number[]>("favorite-networks", []);
	const [expandedRegionAccordions, setExpandedRegionAccordions] = useLocalStorage<string[]>(
		"expanded-region-accordions",
		() => regions?.map(({ id }) => id.toString()) ?? [],
	);

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetTrigger asChild>
				<a
					aria-label="Véhicules en ligne"
					className="leaflet-bar-part leaflet-bar-part-single"
					// biome-ignore lint/a11y/useValidAnchor: required by Leaflet
					href="#"
				>
					<BusFrontIcon className="inline mb-0.5" />
				</a>
			</SheetTrigger>
			<SheetContent
				aria-describedby={undefined}
				className="max-w-[90vw] w-full p-3 overflow-y-auto"
				container={container}
			>
				<SheetHeader className="mb-1">
					<SheetTitle className="text-start">Véhicules en ligne</SheetTitle>
				</SheetHeader>
				<div className="h-[96%] overflow-y-auto">
					{favoriteNetworkIds.length > 0 ? (
						<div className="space-y-2">
							{favoriteNetworkIds.map((networkId) => {
								const network = networks?.find(({ id }) => id === networkId);
								if (typeof network === "undefined") return null;
								return (
									<OnlineVehiclesNetworkCard
										key={networkId}
										network={network}
										onClick={() => onNetworkSelect(network)}
									/>
								);
							})}
						</div>
					) : null}
					<Accordion type="multiple" value={expandedRegionAccordions} onValueChange={setExpandedRegionAccordions}>
						{regions?.map((region) => {
							const relevantNetworks = networksByRegion.get(region.id)?.filter((network) => network.hasVehiclesFeature);
							if (typeof relevantNetworks === "undefined" || relevantNetworks.length === 0) return null;

							return (
								<AccordionItem key={region.id} value={region.id.toString()}>
									<AccordionTrigger>{region.name}</AccordionTrigger>
									<AccordionContent className="space-y-2">
										{relevantNetworks.map((network) => (
											<OnlineVehiclesNetworkCard
												key={network.id}
												network={network}
												onClick={() => onNetworkSelect(network)}
											/>
										))}
									</AccordionContent>
								</AccordionItem>
							);
						})}
					</Accordion>
				</div>
			</SheetContent>
		</Sheet>
	);
}

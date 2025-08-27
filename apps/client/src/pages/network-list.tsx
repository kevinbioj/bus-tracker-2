import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, StarIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useLocalStorage } from "usehooks-ts";

import { GetNetworksQuery, type Network } from "~/api/networks";
import { GetRegionsQuery, type Region } from "~/api/regions";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/utils/utils";

export function NetworkList() {
	const { data: regions } = useSuspenseQuery(GetRegionsQuery);
	const { data: networks } = useSuspenseQuery(GetNetworksQuery);

	const [favoriteNetworkIds] = useLocalStorage<number[]>("favorite-networks", []);

	const favoriteNetworks = networks.filter(({ id }) => favoriteNetworkIds.includes(id));

	const relevantNetworksByRegion = Map.groupBy(
		networks.filter(({ hasVehiclesFeature }) => hasVehiclesFeature),
		(network) => regions.find(({ id }) => id === network.regionId) ?? null,
	);

	return (
		<>
			<title>Données – Bus Tracker</title>
			<main className="p-3 max-w-(--breakpoint-xl) w-full mx-auto">
				<h2 className="font-bold text-2xl">Données des véhicules</h2>
				<p className="text-muted-foreground">
					Seuls les réseaux pour lesquels le suivi des véhicules est disponible sont affichés.
				</p>
				<Separator />
				<Accordion
					className="mt-3"
					defaultValue={[
						"0",
						...Array.from(relevantNetworksByRegion.keys()).map((region) => region?.id.toString() ?? "-1"),
					]}
					type="multiple"
				>
					{favoriteNetworks.length > 0 && (
						<NetworksAccordion
							region={{
								id: 0,
								name: (
									<>
										<span>
											<StarIcon className="inline align-text-bottom fill-yellow-400 stroke-yellow-600" /> Réseaux
											favoris
										</span>
									</>
								),
								sortOrder: 0,
							}}
							networks={favoriteNetworks}
						/>
					)}
					{Array.from(relevantNetworksByRegion.entries())
						.toSorted(([a], [b]) => {
							if (a === null) return 1;
							if (b === null) return -1;
							return a.sortOrder - b.sortOrder;
						})
						.map(([region, networks]) => (
							<NetworksAccordion key={region?.id ?? -1} region={region} networks={networks} />
						))}
				</Accordion>
			</main>
		</>
	);
}

type NetworksAccordionProps = {
	region: (Omit<Region, "name"> & { name: string | React.ReactNode }) | null;
	networks: Network[];
};

function NetworksAccordion({ region, networks }: NetworksAccordionProps) {
	return (
		<AccordionItem className="border-b-0 mb-5" key={region?.id ?? -1} value={region?.id.toString() ?? "-1"}>
			<AccordionTrigger className="font-bold text-xl">{region?.name ?? "Autres réseaux"}</AccordionTrigger>
			<AccordionContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 pb-0 rounded-lg">
				{networks.map((network) => (
					<Link
						className="flex border justify-between items-center h-16 pr-2 py-2 rounded-lg shadow-md transition-colors text-primary-foreground relative bg-primary/25 hover:bg-primary/50"
						key={network.id}
						title={network.authority ? `${network.name} – ${network.authority}` : network.name}
						to={`/data/networks/${network.id}`}
						style={{
							backgroundColor: network.color ?? undefined,
							color: network.textColor ?? undefined,
						}}
					>
						<div className="flex-1 text-center overflow-auto text-wrap px-2">
							<h3 className="font-bold text-lg leading-tight">{network.name}</h3>
							{network.authority !== null && <p className="text-xs">{network.authority}</p>}
						</div>
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
					</Link>
				))}
			</AccordionContent>
		</AccordionItem>
	);
}

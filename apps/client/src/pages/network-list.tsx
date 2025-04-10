import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import { GetNetworksQuery } from "~/api/networks";
import { GetRegionsQuery } from "~/api/regions";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "~/components/ui/accordion";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/lib/utils";

export function NetworkList() {
	const { data: regions } = useSuspenseQuery(GetRegionsQuery);
	const { data: networks } = useSuspenseQuery(GetNetworksQuery);

	const relevantNetworksByRegion = Map.groupBy(
		networks.filter(({ hasVehiclesFeature }) => hasVehiclesFeature),
		(network) => regions.find(({ id }) => id === network.regionId) ?? null,
	);

	return (
		<>
			<title>Données – Bus Tracker</title>
			<main className="p-3 max-w-screen-xl w-full mx-auto">
				<h2 className="font-bold text-2xl">Données des véhicules</h2>
				<p className="text-muted-foreground">
					Seuls les réseaux pour lesquels le suivi des véhicules est disponible sont affichés.
				</p>
				<Separator />
				<Accordion
					className="mt-3"
					defaultValue={Array.from(relevantNetworksByRegion.keys()).map((region) => region?.id.toString() ?? "-1")}
					type="multiple"
				>
					{Array.from(relevantNetworksByRegion.entries())
						.toSorted(([a], [b]) => {
							if (a === null) return 1;
							if (b === null) return -1;
							return a.sortOrder - b.sortOrder;
						})
						.map(([region, networks]) => (
							<AccordionItem className="border-b-0 mb-5" key={region?.id ?? -1} value={region?.id.toString() ?? "-1"}>
								<AccordionTrigger className="font-bold text-xl">{region?.name ?? "Autres réseaux"}</AccordionTrigger>
								<AccordionContent className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-2 gap-3 pb-0 rounded-lg">
									{networks.map((network) => (
										<Link
											className={
												"flex border justify-between items-center h-16 px-4 py-2 rounded-lg shadow-md transition-colors bg-primary hover:bg-primary/70 text-primary-foreground"
											}
											key={network.id}
											title={network.authority ? `${network.name} – ${network.authority}` : network.name}
											to={`/data/networks/${network.id}`}
											style={{
												backgroundColor: network.color ?? undefined,
												color: network.textColor ?? undefined,
											}}
										>
											{network.logoHref ? (
												<>
													<div className="h-full w-full lg:w-40">
														<picture>
															{network.darkModeLogoHref !== null ? (
																<source srcSet={network.darkModeLogoHref} media="(prefers-color-scheme: dark)" />
															) : null}
															<img className="h-full object-contain mx-auto" src={network.logoHref} alt="" />
														</picture>
													</div>
													<Separator
														className="mx-4 bg-foreground dark:bg-foreground hidden lg:block"
														orientation="vertical"
													/>
												</>
											) : null}
											<div className={cn("flex-col flex-1", network.logoHref ? "hidden lg:flex" : "flex")}>
												<h3 className="font-bold text-center lg:text-start text-xl">{network.name}</h3>
												{network.authority ? <p className="hidden lg:block">{network.authority}</p> : null}
											</div>
											<ArrowRight />
										</Link>
									))}
								</AccordionContent>
							</AccordionItem>
						))}
				</Accordion>
			</main>
		</>
	);
}

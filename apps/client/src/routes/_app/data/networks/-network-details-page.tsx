import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";

import { GetNetworkQuery } from "~/api/networks";
import { NetworkHeader } from "~/routes/_app/data/-components/network-header";
import { NetworkPage } from "~/routes/_app/data/-components/networks/network-page";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";

export function NetworkDetails() {
	const { networkId } = useParams({ from: "/_app/data/networks/$networkId" });

	const { data: network } = useSuspenseQuery(GetNetworkQuery(+networkId, true));

	return (
		<>
			<title>{`${network.name} – Données – Bus Tracker`}</title>
			<main className="p-3 max-w-(--breakpoint-xl) w-full mx-auto">
				<NetworkHeader network={network} />
				<Breadcrumb>
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink asChild>
								<Link to="/data">Données</Link>
							</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbPage>
								{network.logoHref ? (
									<picture className="min-w-12 w-fit">
										{network.darkModeLogoHref !== null && (
											<source srcSet={network.darkModeLogoHref} media="(prefers-color-scheme: dark)" />
										)}
										<img className="h-5 object-contain m-auto" src={network.logoHref} alt={network.name} />
									</picture>
								) : (
									network.name
								)}
							</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
				<NetworkPage networkId={network.id} />
			</main>
		</>
	);
}

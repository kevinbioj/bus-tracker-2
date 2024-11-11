import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { GetNetworkQuery } from "~/api/networks";
import { NetworkStatistics } from "~/components/data/networks/network-statistics";
import { NetworkVehicles } from "~/components/data/networks/network-vehicles";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Separator } from "~/components/ui/separator";

export function NetworkDetails() {
	const { networkId } = useParams();
	if (typeof networkId === "undefined") {
		throw new Error("Expected networkId to be provided!");
	}

	const { data: network } = useSuspenseQuery(GetNetworkQuery(+networkId));

	return (
		<main className="p-3 max-w-screen-lg w-full mx-auto">
			{network.logoHref ? (
				<img className="h-16 mx-auto" src={network.logoHref} alt="Logo" />
			) : (
				<h2 className="font-bold text-3xl text-center">{network.name}</h2>
			)}
			<Breadcrumb className="mt-2">
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink asChild>
							<Link to="/data">Données</Link>
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>{network.name}</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>
			<Separator className="my-1" />
			<NetworkStatistics networkId={network.id} />
			<NetworkVehicles networkId={network.id} />
		</main>
	);
}

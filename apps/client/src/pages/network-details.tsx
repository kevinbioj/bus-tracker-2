import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { GetNetworkQuery } from "~/api/networks";
import { NetworkHeader } from "~/components/data/network-header";
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
		<>
			<title>{`${network.name} – Données – Bus Tracker`}</title>
			<main className="p-3 pb-0 max-w-screen-xl w-full mx-auto">
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
							<BreadcrumbPage>{network.name}</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
				<Separator className="my-1" />
				{/* <NetworkStatistics networkId={network.id} /> */}
				<NetworkVehicles networkId={network.id} />
			</main>
		</>
	);
}

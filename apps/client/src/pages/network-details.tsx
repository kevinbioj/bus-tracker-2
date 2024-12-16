import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { GetNetworkQuery } from "~/api/networks";
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
			<div className="flex h-16 space-x-4 w-full">
				{network.logoHref ? (
					<>
						<picture className="mx-auto sm:mx-0">
							{network.darkModeLogoHref !== null ? (
								<source srcSet={network.darkModeLogoHref} media="(prefers-color-scheme: dark)" />
							) : null}
							<img className="h-full w-full sm:w-60" src={network.logoHref} alt="" />
						</picture>
						<Separator className="hidden sm:block" orientation="vertical" />
					</>
				) : null}
				<div className="flex-col my-auto hidden sm:flex">
					<h1 className="font-bold text-3xl">{network.name}</h1>
					{network.authority ? <span>{network.authority}</span> : null}
				</div>
			</div>
			<Breadcrumb className="mt-3">
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
	);
}

import { useSuspenseQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Link, useParams } from "react-router-dom";

import { GetNetworkQuery } from "~/api/networks";
import { GetVehicleQuery } from "~/api/vehicles";
import { NetworkHeader } from "~/components/data/network-header";
import { VehicleActivities } from "~/components/data/vehicles/vehicle-activities";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import tcInfosIcon from "~/icons/tc-infos.png";

const getTcInfosLink = (tcId: number) => `https://tc-infos.fr/vehicule/${tcId}`;

export function VehicleDetails() {
	const { vehicleId } = useParams();
	if (typeof vehicleId === "undefined") {
		throw new Error("Expected vehicleId to be provided!");
	}

	const { data: vehicle } = useSuspenseQuery(GetVehicleQuery(+vehicleId));
	const { data: network } = useSuspenseQuery(GetNetworkQuery(vehicle.networkId));

	return (
		<main className="p-3 max-w-screen-lg w-full mx-auto">
			<NetworkHeader network={network} />
			<div className="relative">
				<Breadcrumb className={clsx("mt-3", { "mr-10": typeof vehicle.tcId !== "undefined" })}>
					<BreadcrumbList>
						<BreadcrumbItem>
							<BreadcrumbLink asChild>
								<Link to="/data">Données</Link>
							</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbLink asChild>
								<Link to={`/data/networks/${network.id}`}>{network.name}</Link>
							</BreadcrumbLink>
						</BreadcrumbItem>
						<BreadcrumbSeparator />
						<BreadcrumbItem>
							<BreadcrumbPage>
								{vehicle.designation ?? "Véhicule"} n°{vehicle.number}
							</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
				{vehicle.tcId ? (
					<Button asChild className="absolute right-0 bottom-0" size="icon">
						<Link target="_blank" to={getTcInfosLink(vehicle.tcId)}>
							<img className="rounded-sm" src={tcInfosIcon} alt="Voir sur TC-Infos" />
						</Link>
					</Button>
				) : null}
			</div>
			<Separator className="my-1" />
			<VehicleActivities vehicleId={vehicle.id} />
		</main>
	);
}

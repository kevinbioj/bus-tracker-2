import { useSuspenseQuery } from "@tanstack/react-query";
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
import { Separator } from "~/components/ui/separator";

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
			<Breadcrumb className="mt-3">
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
			<Separator className="my-1" />
			<VehicleActivities vehicleId={vehicle.id} />
		</main>
	);
}

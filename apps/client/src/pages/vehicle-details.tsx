import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { match } from "ts-pattern";

import { GetNetworkQuery } from "~/api/networks";
import { GetVehicleQuery } from "~/api/vehicles";
import { NetworkHeader } from "~/components/data/network-header";
import { VehicleActivities } from "~/components/data/vehicles/vehicle-activities";
import { VehicleCharacteristics } from "~/components/data/vehicles/vehicle-characteristics";
import { VehicleLive } from "~/components/data/vehicles/vehicle-live";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Separator } from "~/components/ui/separator";
import { BusIcon, ShipIcon, TramwayIcon } from "~/icons/means-of-transport";

export function VehicleDetails() {
	const { vehicleId } = useParams();
	if (typeof vehicleId === "undefined") {
		throw new Error("Expected vehicleId to be provided!");
	}

	const { data: vehicle } = useSuspenseQuery(GetVehicleQuery(+vehicleId));
	const { data: network } = useSuspenseQuery(GetNetworkQuery(vehicle.networkId));

	const vehicleIcon = match(vehicle.type)
		.with("SUBWAY", "TRAMWAY", "RAIL", () => <TramwayIcon className="align-top inline size-4" />)
		.with("FERRY", () => <ShipIcon className="align-top inline size-4" />)
		.otherwise(() => <BusIcon className="align-top inline size-4" />);

	const vehicleDesignation = vehicle.designation ?? "Véhicule";

	return (
		<>
			<title>{`${vehicleDesignation} n°${vehicle.number} – ${network.name} – Données – Bus Tracker`}</title>
			<main className="max-w-(--breakpoint-xl) p-3 w-full mx-auto">
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
								{vehicleIcon} Véhicule n°{vehicle.number}
							</BreadcrumbPage>
						</BreadcrumbItem>
					</BreadcrumbList>
				</Breadcrumb>
				<Separator className="my-1" />
				<div className="flex flex-col lg:flex-row lg:items-start gap-3 w-full">
					<div>
						<VehicleCharacteristics vehicle={vehicle} />
						<VehicleLive vehicle={vehicle} />
					</div>
					<VehicleActivities vehicleId={vehicle.id} />
				</div>
			</main>
		</>
	);
}

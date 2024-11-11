import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { GetNetworkQuery } from "~/api/networks";
import { GetVehiclesQuery } from "~/api/vehicles";
import { VehicleCard } from "~/components/data/vehicle-card";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";

export function NetworkDetails() {
	const { networkId } = useParams();
	if (typeof networkId === "undefined") {
		throw new Error("Expected networkId to be provided!");
	}

	const { data: network } = useSuspenseQuery(GetNetworkQuery(+networkId));
	const { data: vehicles } = useSuspenseQuery(GetVehiclesQuery(+networkId));

	return (
		<main className="p-3 max-w-screen-lg w-full mx-auto">
			{network.logoHref ? <img className="h-20 mx-auto" src={network.logoHref} alt="Logo" /> : null}
			<div className="mt-2 flex items-center gap-2">
				<Button variant="branding-default" size="sm" asChild>
					<Link to="/data">
						<ArrowLeft />
					</Link>
				</Button>
				<h2 className="font-bold text-2xl">Liste des véhicules</h2>
			</div>
			<Separator className="my-2" />
			<div className="flex flex-col gap-2">
				{vehicles.map((vehicle) => (
					<VehicleCard key={vehicle.id} vehicle={vehicle} />
				))}
			</div>
		</main>
	);
}

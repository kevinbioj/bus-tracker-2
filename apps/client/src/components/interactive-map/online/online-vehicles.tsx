import { useQuery } from "@tanstack/react-query";

import { GetVehiclesQuery } from "~/api/vehicles";
import { OnlineVehicleCard } from "~/components/interactive-map/online/online-vehicle-card";

type OnlineVehiclesProps = {
	networkId: number;
	lineId: number;
};

export function OnlineVehicles({ networkId, lineId }: Readonly<OnlineVehiclesProps>) {
	const { data: vehicles } = useQuery(GetVehiclesQuery(networkId));
	if (typeof vehicles === "undefined") return null;

	const lineVehicles = vehicles.filter((vehicle) => vehicle.activity.lineId === lineId);
	return lineVehicles.length > 0 ? (
		<div className="flex flex-col gap-3">
			{lineVehicles.map((vehicle) => (
				<OnlineVehicleCard key={vehicle.id} vehicle={vehicle} />
			))}
		</div>
	) : (
		<p className="mt-3 text-center text-muted-foreground">Aucun véhicule ne circule sur cette ligne.</p>
	);
}

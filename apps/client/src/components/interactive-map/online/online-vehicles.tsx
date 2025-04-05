import { useQuery } from "@tanstack/react-query";

import { GetLineOnlineVehiclesQuery } from "~/api/lines";
import { OnlineVehicleCard } from "~/components/interactive-map/online/online-vehicle-card";

type OnlineVehiclesProps = {
	closeSheet: () => void;
	lineId: number;
};

export function OnlineVehicles({ closeSheet, lineId }: Readonly<OnlineVehiclesProps>) {
	const { data: vehicles } = useQuery(GetLineOnlineVehiclesQuery(lineId));
	if (typeof vehicles === "undefined") return null;

	const lineVehicles = vehicles.filter((vehicle) => vehicle.activity.lineId === lineId);
	return lineVehicles.length > 0 ? (
		<div className="flex flex-col gap-3">
			{lineVehicles
				.toSorted((a, b) => +a.number - +b.number)
				.map((vehicle) => (
					<OnlineVehicleCard key={vehicle.id} closeSheet={closeSheet} vehicle={vehicle} />
				))}
		</div>
	) : (
		<p className="mt-3 text-center text-muted-foreground">Aucun véhicule ne circule sur cette ligne.</p>
	);
}

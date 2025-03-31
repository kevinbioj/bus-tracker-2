import { Link } from "react-router-dom";
import { match } from "ts-pattern";

import type { Vehicle } from "~/api/vehicles";
import { Button } from "~/components/ui/button";
import { BusIcon, ShipIcon, TramwayIcon } from "~/icons/means-of-transport";
import tcInfosIcon from "~/icons/tc-infos.png";

const getTcInfosLink = (tcId: number) => `https://tc-infos.fr/vehicule/${tcId}`;

type VehicleCharacteristicsProps = {
	vehicle: Vehicle;
};

export function VehicleCharacteristics({ vehicle }: Readonly<VehicleCharacteristicsProps>) {
	const vehicleIcon = match(vehicle.type)
		.with("SUBWAY", "TRAMWAY", "RAIL", () => <TramwayIcon className="align-baseline inline size-4" />)
		.with("FERRY", () => <ShipIcon className="align-baseline inline size-4" />)
		.otherwise(() => <BusIcon className="align-baseline inline size-4" />);

	return (
		<div className="border border-border p-3 rounded-md shadow-lg min-w-64 relative">
			<div className="font-bold text-lg">
				{vehicleIcon} Véhicule n°{vehicle.number}
			</div>
			{vehicle.designation !== null && <div>{vehicle.designation}</div>}
			{vehicle.tcId ? (
				<Button asChild className="absolute right-1 top-1" size="icon">
					<Link target="_blank" to={getTcInfosLink(vehicle.tcId)}>
						<img className="rounded-sm" src={tcInfosIcon} alt="Voir sur TC-Infos" />
					</Link>
				</Button>
			) : null}
		</div>
	);
}

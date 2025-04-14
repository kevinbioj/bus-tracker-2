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
		<div className="border border-border px-3 py-2 rounded-md shadow-lg lg:w-80 w-full relative">
			<h2 className="hidden">Informations du véhicule</h2>
			<div className="flex justify-between gap-2">
				<div>
					<div className="font-bold text-lg">
						{vehicleIcon} Véhicule n°{vehicle.number}
					</div>
					{vehicle.designation !== null && <div>{vehicle.designation}</div>}
					{vehicle.operator !== null && (
						<div className="text-sm text-muted-foreground text-end">{vehicle.operator.name}</div>
					)}
				</div>
				{vehicle.tcId ? (
					<Button asChild className="" size="icon">
						<Link target="_blank" to={getTcInfosLink(vehicle.tcId)}>
							<img className="rounded-sm" src={tcInfosIcon} alt="Voir sur TC-Infos" />
						</Link>
					</Button>
				) : null}
			</div>
		</div>
	);
}

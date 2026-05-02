import dayjs from "dayjs";
import { ArchiveIcon } from "lucide-react";
import {
	TbArrowRight as ArrowRightIcon,
	TbCash as CashIcon,
	TbEngine as EngineIcon,
	TbFireExtinguisher as FireExtinguisherIcon,
	TbSkull as SkullIcon,
} from "react-icons/tb";
import { match } from "ts-pattern";

import type { Vehicle } from "~/api/vehicles";
import { Button } from "~/components/ui/button";
import { BusIcon, CoachIcon, ShipIcon, TramwayIcon, TrolleybusIcon } from "~/icons/means-of-transport";
import tcInfosIcon from "~/icons/tc-infos.png";
import * as m from "~/paraglide/messages";
import { VehicleCharacteristicsActions } from "~/routes/_app/data/-components/vehicles/actions/vehicle-characteristics-action-menu";

const getTcInfosLink = (tcId: number) => `https://tc-infos.fr/vehicule/${tcId}`;

type VehicleCharacteristicsProps = {
	vehicle: Vehicle;
};

export function VehicleCharacteristics({ vehicle }: Readonly<VehicleCharacteristicsProps>) {
	const archivedReason = match(vehicle.archivedFor)
		.with("FAILURE", () => m.vehicle_details_archive_reason_failure())
		.with("FIRE", () => m.vehicle_details_archive_reason_fire())
		.with("RETIRED", () => m.vehicle_details_archive_reason_retired())
		.with("SOLD", () => m.vehicle_details_archive_reason_sold())
		.with("TRANSFER", () => m.vehicle_details_archive_reason_transfer())
		.otherwise(() => m.vehicle_details_archive_reason_archived());

	const vehicleIcon = match(vehicle.type)
		.with("SUBWAY", "TRAMWAY", "RAIL", () => <TramwayIcon className="align-baseline inline size-4" />)
		.with("TROLLEY", () => <TrolleybusIcon className="align-baseline inline size-4" />)
		.with("COACH", () => <CoachIcon className="align-baseline inline size-4" />)
		.with("FERRY", () => <ShipIcon className="align-baseline inline size-4" />)
		.otherwise(() => <BusIcon className="align-baseline inline size-4" />);

	return (
		<div className="border border-border px-3 py-2 rounded-md shadow-lg lg:w-80 w-full relative">
			<h2 className="hidden">{m.vehicle_details_characteristics_title()}</h2>
			<div className="flex justify-between gap-2">
				<div>
					<div className="font-bold text-lg">
						{vehicleIcon} {m.vehicle_details_number({ vehicleNumber: vehicle.number })}
					</div>
					{vehicle.designation !== null && <div>{vehicle.designation}</div>}
					{vehicle.operator !== null && (
						<div className="mt-0.5 text-xs text-muted-foreground">
							{m.vehicle_details_operated_by()} <span className="font-bold">{vehicle.operator.name}</span>
						</div>
					)}
					{vehicle.archivedAt !== null && (
						<div className="mt-2 text-xs">
							{match(vehicle.archivedFor)
								.with("FAILURE", () => <EngineIcon className="align-text-bottom inline size-4" />)
								.with("FIRE", () => <FireExtinguisherIcon className="align-text-bottom inline size-4" />)
								.with("RETIRED", () => <SkullIcon className="align-text-bottom inline size-4" />)
								.with("SOLD", () => <CashIcon className="align-text-bottom inline size-4" />)
								.with("TRANSFER", () => <ArrowRightIcon className="align-text-bottom inline size-4" />)
								.otherwise(() => (
									<ArchiveIcon className="align-text-bottom inline size-4" />
								))}{" "}
							{m.vehicle_details_archived_sentence({
								reason: archivedReason,
								date: dayjs(vehicle.archivedAt).format("L"),
								time: dayjs(vehicle.archivedAt).format("LT"),
							})}
						</div>
					)}
				</div>
				<div className="flex gap-2">
					{vehicle.tcId !== null && (
						<Button
							className="border-none"
							size="icon"
							nativeButton={false}
							render={
								<a target="_blank" rel="noreferrer" href={getTcInfosLink(vehicle.tcId)}>
									<img className="rounded-sm" src={tcInfosIcon} alt={m.vehicle_details_tc_infos_alt()} />
								</a>
							}
						/>
					)}
					<VehicleCharacteristicsActions vehicle={vehicle} />
				</div>
			</div>
		</div>
	);
}

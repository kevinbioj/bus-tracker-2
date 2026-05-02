import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { match } from "ts-pattern";

import { GetNetworkQuery } from "~/api/networks";
import { GetVehicleQuery } from "~/api/vehicles";
import * as m from "~/paraglide/messages";
import { DataPageLayout } from "~/routes/_app/data/-components/data-page-layout";
import { VehicleActivities } from "~/routes/_app/data/-components/vehicles/vehicle-activities";
import { VehicleCharacteristics } from "~/routes/_app/data/-components/vehicles/vehicle-characteristics";
import { VehicleLive } from "~/routes/_app/data/-components/vehicles/vehicle-live";
import { BusIcon, CoachIcon, ShipIcon, TramwayIcon, TrolleybusIcon } from "~/icons/means-of-transport";

export function VehicleDetails() {
	const { vehicleId } = useParams({ from: "/_app/data/vehicles/$vehicleId" });

	const { data: vehicle } = useSuspenseQuery(GetVehicleQuery(+vehicleId));
	const { data: network } = useSuspenseQuery(GetNetworkQuery(vehicle.networkId));

	const vehicleIcon = match(vehicle.type)
		.with("SUBWAY", "TRAMWAY", "RAIL", () => <TramwayIcon className="align-top inline size-4" />)
		.with("TROLLEY", () => <TrolleybusIcon className="align-top inline size-4" />)
		.with("COACH", () => <CoachIcon className="align-top inline size-4" />)
		.with("FERRY", () => <ShipIcon className="align-top inline size-4" />)
		.otherwise(() => <BusIcon className="align-top inline size-4" />);

	const vehicleDesignation = vehicle.designation ?? m.vehicle_default_designation();

	return (
		<DataPageLayout
			current={
				<>
					{vehicleIcon} {m.vehicle_breadcrumb({ vehicleNumber: vehicle.number })}
				</>
			}
			network={network}
			title={m.page_title_vehicle_data({
				designation: vehicleDesignation,
				networkName: network.name,
				vehicleNumber: vehicle.number,
			})}
		>
			<div className="mt-1 flex flex-col lg:flex-row lg:items-start gap-3 w-full">
				<div className="lg:sticky lg:top-16">
					<VehicleCharacteristics vehicle={vehicle} />
					<VehicleLive vehicle={vehicle} />
				</div>
				<VehicleActivities vehicleId={vehicle.id} />
			</div>
		</DataPageLayout>
	);
}

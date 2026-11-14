import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";

import { GetNetworkQuery } from "~/api/networks";
import { GetVehicleQuery } from "~/api/vehicles";
import * as m from "~/paraglide/messages";
import { subtitleLinkClassName } from "~/routes/_app/data/-components/data-page-header";
import { DataPageLayout } from "~/routes/_app/data/-components/data-page-layout";
import { VehicleActivities } from "~/routes/_app/data/-components/vehicles/vehicle-activities";
import { VehicleCharacteristics } from "~/routes/_app/data/-components/vehicles/vehicle-characteristics";
import { VehicleLive } from "~/routes/_app/data/-components/vehicles/vehicle-live";
import { VehicleTypeTile } from "~/routes/_app/data/-components/vehicles/vehicle-type-tile";

export function VehicleDetails() {
	const { vehicleId } = useParams({ from: "/_app/data/vehicles/$vehicleId" });

	const { data: vehicle } = useSuspenseQuery(GetVehicleQuery(+vehicleId));
	const { data: network } = useSuspenseQuery(GetNetworkQuery(vehicle.networkId));

	const vehicleDesignation = vehicle.designation ?? m.vehicle_default_designation();

	return (
		<DataPageLayout
			back={{
				label: m.data_back_to_network({ networkName: network.name }),
				link: <Link params={{ networkId: String(network.id) }} to="/data/networks/$networkId" />,
			}}
			heading={m.vehicle_details_number({ vehicleNumber: vehicle.number })}
			media={<VehicleTypeTile type={vehicle.type} />}
			subtitle={
				<Link
					className={subtitleLinkClassName}
					params={{ networkId: String(network.id) }}
					to="/data/networks/$networkId"
				>
					{network.name}
				</Link>
			}
			title={m.page_title_vehicle_data({
				designation: vehicleDesignation,
				networkName: network.name,
				vehicleNumber: vehicle.number,
			})}
		>
			<div className="flex flex-col lg:flex-row lg:items-start gap-3 w-full">
				<div className="flex flex-col gap-3 lg:sticky lg:top-16">
					<VehicleCharacteristics vehicle={vehicle} />
					<VehicleLive vehicle={vehicle} />
				</div>
				<VehicleActivities vehicleId={vehicle.id} />
			</div>
		</DataPageLayout>
	);
}

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { GetNetworkQuery, type Line, type Network } from "~/api/networks";
import { OnlineVehiclesLineSelection } from "~/components/vehicles-map/online-vehicles/line-selection/online-vehicles-line-selection";
import { OnlineVehiclesNetworkSelection } from "~/components/vehicles-map/online-vehicles/network-selection/online-vehicles-network-selection";

type OnlineVehiclesSheetManagement = {
	fixedNetworkId?: number;
	onFilterChange: (line?: Line) => void;
	open: boolean;
	setOpen: (open: boolean) => void;
};

export function OnlineVehiclesSheetManagement({
	fixedNetworkId,
	onFilterChange,
	open,
	setOpen,
}: Readonly<OnlineVehiclesSheetManagement>) {
	const { data: fixedNetwork } = useQuery(GetNetworkQuery(fixedNetworkId));

	const [selectedNetwork, setSelectedNetwork] = useState<Network>();

	const handleClose = () => {
		if (selectedNetwork !== undefined) return setSelectedNetwork(undefined);
		setOpen(false);
	};

	return (
		<>
			{fixedNetwork ? null : (
				<OnlineVehiclesNetworkSelection
					open={!selectedNetwork && open}
					onOpenChange={setOpen}
					onNetworkSelect={setSelectedNetwork}
				/>
			)}
			<OnlineVehiclesLineSelection
				network={open ? (fixedNetwork ?? selectedNetwork) : undefined}
				onClose={handleClose}
				onLineChange={(line) => {
					if (line !== undefined) {
						onFilterChange(line);
						setOpen(false);
					}
				}}
			/>
		</>
	);
}

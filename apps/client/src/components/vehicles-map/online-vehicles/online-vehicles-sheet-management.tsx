import { useState } from "react";

import type { Line, Network } from "~/api/networks";
import { OnlineVehiclesLineSelection } from "~/components/vehicles-map/online-vehicles/line-selection/online-vehicles-line-selection";
import { OnlineVehiclesNetworkSelection } from "~/components/vehicles-map/online-vehicles/network-selection/online-vehicles-network-selection";
import { OnlineVehiclesVehicleSelection } from "~/components/vehicles-map/online-vehicles/vehicle-selection/online-vehicles-vehicle-selection";

let doubleCloseGuard = false;

type OnlineVehiclesSheetManagement = {
	open: boolean;
	setOpen: (open: boolean) => void;
};

export function OnlineVehiclesSheetManagement({ open, setOpen }: OnlineVehiclesSheetManagement) {
	const [selectedNetwork, setSelectedNetwork] = useState<Network>();
	const [selectedLine, setSelectedLine] = useState<Line>();

	const handleClose = () => {
		if (doubleCloseGuard) return;

		doubleCloseGuard = true;
		setTimeout(() => {
			doubleCloseGuard = false;
		}, 100);

		if (typeof selectedLine !== "undefined") return setSelectedLine(undefined);
		if (typeof selectedNetwork !== "undefined") return setSelectedNetwork(undefined);
		setOpen(false);
	};

	return (
		<>
			<OnlineVehiclesNetworkSelection open={open} onOpenChange={setOpen} onNetworkSelect={setSelectedNetwork} />
			<OnlineVehiclesLineSelection
				network={open ? selectedNetwork : undefined}
				onClose={handleClose}
				onLineChange={(line) => setSelectedLine(line)}
			/>
			<OnlineVehiclesVehicleSelection
				network={open ? selectedNetwork : undefined}
				line={open ? selectedLine : undefined}
				onClose={handleClose}
				onVehicleSelect={() => {
					setOpen(false);
				}}
			/>
		</>
	);
}

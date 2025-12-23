import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { GetNetworkQuery, type Line, type Network } from "~/api/networks";
import { OnlineVehiclesLineSelection } from "~/components/vehicles-map/online-vehicles/line-selection/online-vehicles-line-selection";
import { OnlineVehiclesNetworkSelection } from "~/components/vehicles-map/online-vehicles/network-selection/online-vehicles-network-selection";
import { OnlineVehiclesVehicleSelection } from "~/components/vehicles-map/online-vehicles/vehicle-selection/online-vehicles-vehicle-selection";

type OnlineVehiclesSheetManagement = {
	fixedNetworkId?: number;
	open: boolean;
	setOpen: (open: boolean) => void;
};

export function OnlineVehiclesSheetManagement({ fixedNetworkId, open, setOpen }: OnlineVehiclesSheetManagement) {
	const { data: fixedNetwork } = useQuery(GetNetworkQuery(fixedNetworkId));

	const [selectedNetwork, setSelectedNetwork] = useState<Network>();
	const [selectedLine, setSelectedLine] = useState<Line>();

	const networkSelectionContainer = useRef<HTMLDivElement>(null);
	if (networkSelectionContainer.current === null) {
		networkSelectionContainer.current = document.createElement("div");
		networkSelectionContainer.current.id = "network-selection-sheet";
		document.body.append(networkSelectionContainer.current);
	}

	const lineSelectionContainer = useRef<HTMLDivElement>(null);
	if (lineSelectionContainer.current === null) {
		lineSelectionContainer.current = document.createElement("div");
		lineSelectionContainer.current.id = "line-selection-sheet";
		document.body.append(lineSelectionContainer.current);
	}

	const vehicleSelectionContainer = useRef<HTMLDivElement>(null);
	if (networkSelectionContainer.current === null) {
		networkSelectionContainer.current = document.createElement("div");
		networkSelectionContainer.current.id = "network-selection-sheet";
		document.body.append(networkSelectionContainer.current);
	}

	const handleClose = () => {
		if (typeof selectedLine !== "undefined") return setSelectedLine(undefined);
		if (typeof selectedNetwork !== "undefined") return setSelectedNetwork(undefined);
		setOpen(false);
	};

	return (
		<>
			{fixedNetwork ? null : (
				<OnlineVehiclesNetworkSelection
					container={networkSelectionContainer.current}
					open={open}
					onOpenChange={setOpen}
					onNetworkSelect={setSelectedNetwork}
				/>
			)}
			<OnlineVehiclesLineSelection
				container={lineSelectionContainer.current}
				network={open ? (fixedNetwork ?? selectedNetwork) : undefined}
				onClose={handleClose}
				onLineChange={(line) => setSelectedLine(line)}
				withBackdrop={Boolean(fixedNetworkId)}
			/>
			<OnlineVehiclesVehicleSelection
				container={vehicleSelectionContainer.current}
				embedMode={Boolean(fixedNetworkId)}
				network={open ? (fixedNetwork ?? selectedNetwork) : undefined}
				line={open ? selectedLine : undefined}
				onClose={handleClose}
				onVehicleSelect={() => {
					setOpen(false);
				}}
			/>
		</>
	);
}

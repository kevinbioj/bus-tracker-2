import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";

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

	const handleClose = () => {
		if (selectedNetwork !== undefined) return setSelectedNetwork(undefined);
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
				onLineChange={(line) => {
					if (line !== undefined) {
						onFilterChange(line);
						setOpen(false);
					}
				}}
				withBackdrop={Boolean(fixedNetworkId)}
			/>
		</>
	);
}

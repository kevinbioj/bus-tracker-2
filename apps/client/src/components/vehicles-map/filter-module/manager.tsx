import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { GetNetworkQuery, type Line, type Network } from "~/api/networks";
import { FilterModuleLinesList } from "~/components/vehicles-map/filter-module/line/lines-list";
import { FilterModuleNetworkList } from "~/components/vehicles-map/filter-module/network/networks-list";

type FilterModuleManagerProps = {
	fixedNetworkId?: number;
	onFilterChange: (line?: Line) => void;
	open: boolean;
	setOpen: (open: boolean) => void;
};

export function FilterModuleManager({
	fixedNetworkId,
	onFilterChange,
	open,
	setOpen,
}: Readonly<FilterModuleManagerProps>) {
	const { data: fixedNetwork } = useQuery(GetNetworkQuery(fixedNetworkId));

	const [selectedNetwork, setSelectedNetwork] = useState<Network>();

	const handleClose = () => {
		if (selectedNetwork !== undefined) return setSelectedNetwork(undefined);
		setOpen(false);
	};

	return (
		<>
			{fixedNetwork ? null : (
				<FilterModuleNetworkList
					open={!selectedNetwork && open}
					onOpenChange={setOpen}
					onNetworkSelect={setSelectedNetwork}
				/>
			)}
			<FilterModuleLinesList
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

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { GetNetworkQuery, type Network } from "~/api/networks";
import { FilterModuleLinesList } from "~/components/vehicles-map/filter-module/line/lines-list";
import type { MapFilter } from "~/components/vehicles-map/filter-module/map-filter";
import { FilterModuleNetworkList } from "~/components/vehicles-map/filter-module/network/networks-list";

type FilterModuleManagerProps = {
	fixedNetworkId?: number;
	onFilterChange: (filter?: MapFilter) => void;
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

	const network = open ? (fixedNetwork ?? selectedNetwork) : undefined;

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
				network={network}
				onClose={handleClose}
				onLineChange={(line) => {
					if (line !== undefined) {
						onFilterChange({ kind: "line", network, line });
						setOpen(false);
					}
				}}
				// En mode embarqué le réseau est déjà l'intégralité de ce qui s'affiche.
				onNetworkChange={
					fixedNetworkId !== undefined
						? undefined
						: (network) => {
								onFilterChange({ kind: "network", network });
								setSelectedNetwork(undefined);
								setOpen(false);
							}
				}
			/>
		</>
	);
}

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, CircleIcon, FilterXIcon } from "lucide-react";
import type maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { useDebounceValue } from "usehooks-ts";

import { useMap } from "~/adapters/maplibre-gl/map";
import { useMapBounds } from "~/adapters/maplibre-gl/use-map-bounds";
import type { Line, Network } from "~/api/networks";
import { GetVehicleJourneyMarkersQuery } from "~/api/vehicle-journeys";
import { OnlineVehiclesSheetManagement } from "~/components/vehicles-map/online-vehicles/online-vehicles-sheet-management";
import { BusIcon } from "~/icons/means-of-transport";

type OnlineControlProps = {
	filteredLine?: Line;
	filteredNetwork?: Network;
	fixedNetworkId?: number;
	onFilterChange: (line?: Line) => void;
};

export function OnlineControl({
	filteredLine,
	filteredNetwork,
	fixedNetworkId,
	onFilterChange,
}: Readonly<OnlineControlProps>) {
	const map = useMap();
	const activatorRef = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(false);

	const [bounds] = useDebounceValue(useMapBounds(), 250);
	const { data, isPlaceholderData } = useQuery(GetVehicleJourneyMarkersQuery(bounds, fixedNetworkId, filteredLine?.id));

	useEffect(() => {
		if (activatorRef.current === null) return;

		const control: maplibregl.IControl = {
			onAdd: () => activatorRef.current!,
			onRemove: () => void 0,
		};

		map.addControl(control, "top-left");
		return () => {
			map.removeControl(control);
		};
	}, [map]);

	return (
		<>
			<div className="maplibregl-ctrl maplibregl-ctrl-group text-black" ref={activatorRef}>
				{filteredLine ? (
					<div className="font-sans flex items-center gap-1.5 mr-1">
						<button onClick={() => onFilterChange(undefined)} title="Désactiver le filtre" type="button">
							<FilterXIcon className="m-auto size-5" />
						</button>

						{filteredNetwork ? (
							<div className="flex items-center gap-1.5">
								{filteredNetwork.logoHref === null ? (
									<span className="text-base">{filteredNetwork.name}</span>
								) : (
									<picture className="h-5">
										<img className="h-full object-contain" src={filteredNetwork.logoHref} alt={filteredNetwork.name} />
									</picture>
								)}
								<ChevronRight className="size-3 text-muted-foreground" />
							</div>
						) : null}

						<div className="flex items-center gap-1.5">
							{filteredLine?.cartridgeHref ? (
								<img
									className="h-5 object-contain rounded-sm"
									src={filteredLine.cartridgeHref}
									alt={filteredLine.number}
								/>
							) : (
								<span className="mr-1 text-base">{filteredLine.number}</span>
							)}
							{!isPlaceholderData && (
								<span className="text-muted-foreground tabular-nums">
									{data?.items.length ?? 0}
									<CircleIcon className="align-text-top animate-pulse fill-green-500 stroke-none size-1.5 inline ml-0.5" />
								</span>
							)}
						</div>
					</div>
				) : (
					<button onClick={() => setOpen(true)} title="Véhicules en ligne" type="button">
						<BusIcon className="m-auto p-1" />
					</button>
				)}
			</div>
			<OnlineVehiclesSheetManagement
				fixedNetworkId={fixedNetworkId}
				open={open}
				setOpen={setOpen}
				onFilterChange={onFilterChange}
			/>
		</>
	);
}

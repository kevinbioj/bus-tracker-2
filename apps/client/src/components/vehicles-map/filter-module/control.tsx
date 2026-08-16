import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, CircleIcon, FilterIcon, FilterXIcon, HistoryIcon } from "lucide-react";
import type { IControl } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { useDebounceValue } from "usehooks-ts";

import { useMap } from "~/adapters/maplibre-gl/map";
import { useMapBounds } from "~/adapters/maplibre-gl/use-map-bounds";
import type { Line, Network } from "~/api/networks";
import { GetVehicleJourneyMarkersQuery } from "~/api/vehicle-journeys";
import { FilterModuleManager } from "~/components/vehicles-map/filter-module/manager";
import * as m from "~/paraglide/messages";

type FilterModuleControlProps = {
	filteredLine?: Line;
	filteredNetwork?: Network;
	fixedNetworkId?: number;
	onFilterChange: (line?: Line) => void;
	withLineDataLink?: boolean;
};

export function FilterModuleControl({
	filteredLine,
	filteredNetwork,
	fixedNetworkId,
	onFilterChange,
	withLineDataLink = true,
}: Readonly<FilterModuleControlProps>) {
	const map = useMap();
	const activatorRef = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(false);

	const [bounds] = useDebounceValue(useMapBounds(), 250);
	const { data, isPlaceholderData } = useQuery(GetVehicleJourneyMarkersQuery(bounds, fixedNetworkId, filteredLine?.id));

	useEffect(() => {
		if (activatorRef.current === null) return;

		const control: IControl = {
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
			<div
				className="maplibregl-ctrl maplibregl-ctrl-group max-w-[calc(100vw-6.5rem)] text-black"
				ref={activatorRef}
			>
				{filteredLine ? (
					<div className="font-sans flex items-center gap-1.5 min-w-0 mr-1">
						<button
							className="shrink-0"
							onClick={() => onFilterChange(undefined)}
							title={m.map_filter_disable()}
							type="button"
						>
							<FilterXIcon className="m-auto size-5" />
						</button>

						{filteredNetwork ? (
							<>
								{filteredNetwork.logoHref === null ? (
									<span className="max-w-24 shrink text-base truncate" title={filteredNetwork.name}>
										{filteredNetwork.name}
									</span>
								) : (
									<img
										className="h-5 max-w-20 sm:max-w-32 object-contain shrink-0"
										src={filteredNetwork.logoHref}
										alt={filteredNetwork.name}
									/>
								)}
								<ChevronRight className="shrink-0 size-3 text-muted-foreground" />
							</>
						) : null}

						{filteredLine?.cartridgeHref ? (
							<img
								className="h-5 max-w-20 sm:max-w-32 object-contain shrink-0"
								src={filteredLine.cartridgeHref}
								alt={filteredLine.number}
							/>
						) : (
							<span className="flex-1 max-w-64 min-w-0 text-base truncate" title={filteredLine.number}>
								{filteredLine.number}
							</span>
						)}

						{!isPlaceholderData && (
							<span className="shrink-0 text-muted-foreground tabular-nums">
								{data?.items.length ?? 0}
								<CircleIcon className="align-text-top animate-pulse fill-green-500 stroke-none size-1.5 inline ml-0.5" />
							</span>
						)}

						{withLineDataLink && (
							<>
								<span aria-hidden className="bg-black/15 h-5 shrink-0 w-px" />

								<Link
									className="flex items-center shrink-0"
									params={{ lineId: `${filteredLine.id}` }}
									title={m.map_filter_line_data()}
									to="/data/lines/$lineId"
								>
									<HistoryIcon className="size-5" />
								</Link>
							</>
						)}
					</div>
				) : (
					<button onClick={() => setOpen(true)} title={m.map_filter_vehicles()} type="button">
						<FilterIcon className="m-auto p-0.5" />
					</button>
				)}
			</div>
			<FilterModuleManager
				fixedNetworkId={fixedNetworkId}
				open={open}
				setOpen={setOpen}
				onFilterChange={onFilterChange}
			/>
		</>
	);
}

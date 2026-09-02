import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import { ChevronRight, CircleIcon, FilterIcon, FilterXIcon, HistoryIcon, TableIcon } from "lucide-react";
import type { IControl } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { useDebounceValue } from "usehooks-ts";

import { useMap } from "~/adapters/maplibre-gl/map";
import { useMapBounds } from "~/adapters/maplibre-gl/use-map-bounds";
import type { Network } from "~/api/networks";
import { GetVehicleJourneyMarkersQuery } from "~/api/vehicle-journeys";
import { FilterModuleManager } from "~/components/vehicles-map/filter-module/manager";
import type { MapFilter } from "~/components/vehicles-map/filter-module/map-filter";
import * as m from "~/paraglide/messages";

type NetworkBadgeProps = {
	network: Network;
};

function NetworkBadge({ network }: Readonly<NetworkBadgeProps>) {
	if (network.logoHref === null) {
		return (
			<span className="max-w-24 shrink text-base truncate" title={network.name}>
				{network.name}
			</span>
		);
	}

	return <img className="h-5 max-w-20 sm:max-w-32 object-contain shrink-0" src={network.logoHref} alt={network.name} />;
}

type FilterModuleControlProps = {
	filter?: MapFilter;
	fixedNetworkId?: number;
	onFilterChange: (filter?: MapFilter) => void;
	withDataLink?: boolean;
};

export function FilterModuleControl({
	filter,
	fixedNetworkId,
	onFilterChange,
	withDataLink = true,
}: Readonly<FilterModuleControlProps>) {
	const map = useMap();
	const activatorRef = useRef<HTMLDivElement>(null);
	const [open, setOpen] = useState(false);

	const [bounds] = useDebounceValue(useMapBounds(), 250);
	// Mêmes arguments que ceux de la couche de marqueurs : les deux partagent le cache de la query.
	const { data, isPlaceholderData } = useQuery(
		GetVehicleJourneyMarkersQuery(bounds, {
			embeddedNetworkId: fixedNetworkId,
			filteredNetworkId: filter?.kind === "network" ? filter.network.id : undefined,
			lineId: filter?.kind === "line" ? filter.line.id : undefined,
		}),
	);

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
			<div className="maplibregl-ctrl maplibregl-ctrl-group max-w-[calc(100vw-6.5rem)] text-black" ref={activatorRef}>
				{filter ? (
					<div className="font-sans flex items-center gap-1.5 min-w-0 mr-1">
						<button
							className="shrink-0"
							onClick={() => onFilterChange(undefined)}
							title={m.map_filter_disable()}
							type="button"
						>
							<FilterXIcon className="m-auto size-5" />
						</button>

						{filter.kind === "network" ? (
							<NetworkBadge network={filter.network} />
						) : (
							<>
								{filter.network ? (
									<>
										<NetworkBadge network={filter.network} />
										<ChevronRight className="shrink-0 size-3 text-muted-foreground" />
									</>
								) : null}

								{filter.line.cartridgeHref ? (
									<img
										className="h-5 max-w-20 sm:max-w-32 object-contain shrink-0"
										src={filter.line.cartridgeHref}
										alt={filter.line.number}
									/>
								) : (
									<div
										className={clsx(
											"flex justify-center rounded-sm",
											filter.line.color !== null ? "min-w-6" : "min-w-0",
										)}
										style={{
											backgroundColor: filter.line.color ?? undefined,
											color: filter.line.textColor ?? undefined,
										}}
									>
										<span
											className={clsx(
												"max-w-64 text-base leading-tight pt-px truncate",
												filter.line.color !== null && "font-bold px-1",
											)}
											title={filter.line.number}
										>
											{filter.line.number}
										</span>
									</div>
								)}
							</>
						)}

						{!isPlaceholderData && (
							<span className="shrink-0 text-muted-foreground tabular-nums">
								{data?.items.length ?? 0}
								<CircleIcon className="align-text-top animate-pulse fill-green-500 stroke-none size-1.5 inline ml-0.5" />
							</span>
						)}

						{withDataLink && (
							<>
								<span aria-hidden className="bg-black/15 h-5 shrink-0 w-px" />

								{filter.kind === "network" ? (
									<Link
										className="flex items-center shrink-0"
										params={{ networkId: `${filter.network.id}` }}
										title={m.map_filter_network_data()}
										to="/data/networks/$networkId"
									>
										{/* La page réseau liste le parc et les lignes : un inventaire, pas un historique. */}
										<TableIcon className="size-5" />
									</Link>
								) : (
									<Link
										className="flex items-center shrink-0"
										params={{ lineId: `${filter.line.id}` }}
										title={m.map_filter_line_data()}
										to="/data/lines/$lineId"
									>
										<HistoryIcon className="size-5" />
									</Link>
								)}
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

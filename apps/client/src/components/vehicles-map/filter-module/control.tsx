import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import { ChevronRight, CircleIcon, FilterIcon, FilterXIcon, HistoryIcon, TableIcon } from "lucide-react";
import type { IControl } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { useDebounceValue } from "usehooks-ts";

import { useMap } from "~/adapters/maplibre-gl/map";
import { useMapBounds } from "~/adapters/maplibre-gl/use-map-bounds";
import type { Line, Network } from "~/api/networks";
import { useRealtimeAvailable } from "~/api/realtime";
import { GetLineAlertsQuery } from "~/api/service-alerts";
import { GetVehicleJourneyMarkersQuery } from "~/api/vehicle-journeys";
import { ServiceAlertsButton } from "~/components/service-alerts/service-alerts-button";
import { FilterModuleManager } from "~/components/vehicles-map/filter-module/manager";
import type { MapFilter } from "~/components/vehicles-map/filter-module/map-filter";
import { useMapTheme } from "~/components/vehicles-map/map-style";
import * as m from "~/paraglide/messages";

type NetworkBadgeProps = {
	network: Network;
};

function NetworkBadge({ network }: Readonly<NetworkBadgeProps>) {
	const mapTheme = useMapTheme();

	if (network.logoHref === null) {
		return (
			<span className="max-w-24 shrink text-base truncate" title={network.name}>
				{network.name}
			</span>
		);
	}

	return (
		<img
			className="h-5 min-w-0 max-w-16 sm:max-w-32 object-contain shrink-[4]"
			src={(mapTheme === "dark" ? network.darkModeLogoHref : null) ?? network.logoHref}
			alt={network.name}
		/>
	);
}

type FilterModuleVehiclesCountProps = {
	filter: MapFilter;
	fixedNetworkId?: number;
};

/**
 * Compteur des véhicules affichés. Isolé du reste du contrôle car il est le seul à suivre les
 * bornes de la carte : les observer plus haut ferait rerendre tout le module à chaque déplacement
 * de carte et à chaque rafraîchissement des marqueurs.
 */
function FilterModuleVehiclesCount({ filter, fixedNetworkId }: Readonly<FilterModuleVehiclesCountProps>) {
	const [bounds] = useDebounceValue(useMapBounds(), 250);
	const realtime = useRealtimeAvailable();
	// Mêmes arguments que ceux de la couche de marqueurs : les deux partagent le cache de la query.
	const { data, isPlaceholderData } = useQuery(
		GetVehicleJourneyMarkersQuery(
			bounds,
			{
				embeddedNetworkId: fixedNetworkId,
				filteredNetworkId: filter.kind === "network" ? filter.network.id : undefined,
				lineId: filter.kind === "line" ? filter.line.id : undefined,
			},
			realtime,
		),
	);

	if (isPlaceholderData) return null;
	return (
		<span className="shrink-0 text-muted-foreground tabular-nums">
			<span aria-hidden="true">
				{data?.items.length ?? 0}
				<CircleIcon className="align-text-top animate-pulse fill-green-500 stroke-none size-1.5 inline ml-0.5" />
			</span>
			<span className="sr-only">{m.map_filter_vehicle_count({ count: data?.items.length ?? 0 })}</span>
		</span>
	);
}

/**
 * Info trafic de la ligne filtrée, à côté du compteur de véhicules. Indépendante du panneau des
 * véhicules en ligne, qu'un réglage peut masquer.
 */
function FilterModuleLineAlerts({ line }: Readonly<{ line: Line }>) {
	const realtime = useRealtimeAvailable();
	const { data: alerts = [] } = useQuery(GetLineAlertsQuery(line.id, realtime));
	return <ServiceAlertsButton alerts={alerts} scope="line" />;
}

const subtleActionClassName =
	"flex items-center justify-center shrink-0 rounded-md bg-branding/10 text-branding transition-colors outline-none hover:bg-branding hover:text-branding-foreground dark:bg-branding/40 dark:text-branding-foreground dark:hover:bg-branding focus-visible:ring-2 focus-visible:ring-branding/50";

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
			<div className="maplibregl-ctrl max-w-[calc(100vw-6.5rem)] font-sans" ref={activatorRef}>
				{filter ? (
					<div className="flex items-center gap-1.5 h-9 min-w-0 overflow-hidden pl-1 pr-1 rounded-lg bg-card text-card-foreground shadow-md ring-2 ring-card">
						<button
							className={clsx(subtleActionClassName, "size-7")}
							data-slot="map-filter-button"
							onClick={() => onFilterChange(undefined)}
							title={m.map_filter_disable()}
							type="button"
						>
							<FilterXIcon className="size-4.5" />
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
												"max-w-64 text-base leading-tight truncate",
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

						<FilterModuleVehiclesCount filter={filter} fixedNetworkId={fixedNetworkId} />

						{filter.kind === "line" && <FilterModuleLineAlerts line={filter.line} />}

						{withDataLink &&
							(filter.kind === "network" ? (
								<Link
									className={clsx(subtleActionClassName, "gap-1.5 h-7 px-1.5 sm:px-2.5 text-sm")}
									params={{ networkId: `${filter.network.id}` }}
									title={m.map_filter_network_data()}
									to="/data/networks/$networkId"
								>
									{/* La page réseau liste le parc et les lignes : un inventaire, pas un historique. */}
									<TableIcon className="shrink-0 size-4" />
									<span className="hidden sm:inline">{m.map_filter_network_data()}</span>
								</Link>
							) : (
								<Link
									className={clsx(subtleActionClassName, "gap-1.5 h-7 px-1.5 sm:px-2.5 text-sm")}
									params={{ lineId: `${filter.line.id}` }}
									title={m.map_filter_line_data()}
									to="/data/lines/$lineId"
								>
									<HistoryIcon className="shrink-0 size-4" />
									<span className="hidden sm:inline">{m.map_filter_line_data()}</span>
								</Link>
							))}
					</div>
				) : (
					<button
						className="flex items-center gap-2 h-9 px-3.5 rounded-lg bg-card text-card-foreground text-sm shadow-md ring-2 ring-card transition-colors outline-none hover:bg-[color-mix(in_srgb,var(--color-branding)_10%,var(--card))] dark:hover:bg-[color-mix(in_srgb,var(--color-branding)_30%,var(--card))] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-branding"
						data-slot="map-filter-button"
						onClick={() => setOpen(true)}
						title={m.map_filter_vehicles()}
						type="button"
					>
						<FilterIcon className="shrink-0 size-4" />
						{fixedNetworkId !== undefined ? (
							<span>{m.map_filter_by_line()}</span>
						) : (
							<>
								<span className="hidden sm:inline">{m.map_filter_by_network_or_line()}</span>
								<span className="sm:hidden">{m.map_filter_short()}</span>
							</>
						)}
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

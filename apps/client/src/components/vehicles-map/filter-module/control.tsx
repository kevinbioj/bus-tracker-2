import { type UseQueryResult, useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import {
	ChevronDownIcon,
	ChevronRight,
	CircleIcon,
	FilterIcon,
	FilterXIcon,
	HistoryIcon,
	ListIcon,
	TableIcon,
} from "lucide-react";
import type { IControl } from "maplibre-gl";
import { useEffect, useId, useRef, useState } from "react";
import { useDebounceValue } from "usehooks-ts";

import { useMap } from "~/adapters/maplibre-gl/map";
import { useMapBounds } from "~/adapters/maplibre-gl/use-map-bounds";
import type { Line, Network } from "~/api/networks";
import { useRealtimeAvailable } from "~/api/realtime";
import { GetLineAlertsQuery, type ServiceAlert } from "~/api/service-alerts";
import { GetVehicleJourneyMarkersQuery } from "~/api/vehicle-journeys";
import { ServiceAlertsButton } from "~/components/service-alerts/service-alerts-button";
import { FilterModuleManager } from "~/components/vehicles-map/filter-module/manager";
import { MAX_FILTERED_LINES, type MapFilter } from "~/components/vehicles-map/filter-module/map-filter";
import { NetworkLinesPanel, useNetworkActiveLines } from "~/components/vehicles-map/filter-module/network-lines-links";
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
				lineIds: filter.kind === "line" ? filter.lines.map((line) => line.id) : undefined,
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

function combineLineAlerts(results: UseQueryResult<ServiceAlert[]>[]) {
	const alerts = new Map<string, ServiceAlert>();
	for (const alert of results.flatMap((result) => result.data ?? [])) alerts.set(alert.id, alert);
	return [...alerts.values()];
}

/**
 * Info trafic des lignes filtrées, à côté du compteur de véhicules. Indépendante du panneau des
 * véhicules en ligne, qu'un réglage peut masquer.
 */
function FilterModuleLineAlerts({ lines }: Readonly<{ lines: Line[] }>) {
	const realtime = useRealtimeAvailable();
	const alerts = useQueries({
		queries: lines.map((line) => GetLineAlertsQuery(line.id, realtime)),
		combine: combineLineAlerts,
	});
	return <ServiceAlertsButton alerts={alerts} scope="line" />;
}

const MAX_DISPLAYED_LINE_BADGES = 4;

function LineBadge({ line, compact }: Readonly<{ line: Line; compact: boolean }>) {
	if (line.cartridgeHref) {
		return (
			<img
				className={clsx("h-5 object-contain shrink-0", compact ? "max-w-12 sm:max-w-16" : "max-w-20 sm:max-w-32")}
				src={line.cartridgeHref}
				alt={line.number}
			/>
		);
	}

	return (
		<div
			className={clsx("flex justify-center rounded-sm", line.color !== null ? "min-w-6" : "min-w-0")}
			style={{
				backgroundColor: line.color ?? undefined,
				color: line.textColor ?? undefined,
			}}
		>
			<span
				className={clsx(
					"text-base leading-tight truncate",
					compact ? "max-w-20" : "max-w-64",
					line.color !== null && "font-bold px-1",
				)}
				title={line.number}
			>
				{line.number}
			</span>
		</div>
	);
}

function LineBadges({ lines }: Readonly<{ lines: Line[] }>) {
	const displayedLines =
		lines.length > MAX_DISPLAYED_LINE_BADGES ? lines.slice(0, MAX_DISPLAYED_LINE_BADGES - 1) : lines;
	const hiddenCount = lines.length - displayedLines.length;
	const compact = lines.length > 1;

	return (
		<span
			className="flex items-center gap-1 min-w-0"
			title={compact ? lines.map((line) => line.number).join(", ") : undefined}
		>
			{displayedLines.map((line) => (
				<LineBadge compact={compact} key={line.id} line={line} />
			))}
			{hiddenCount > 0 && <span className="shrink-0 text-sm text-muted-foreground tabular-nums">+{hiddenCount}</span>}
		</span>
	);
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
	const [linesOpen, setLinesOpen] = useState(false);
	const linesPanelId = useId();
	const lines = useNetworkActiveLines(fixedNetworkId === undefined ? filter?.network : undefined);
	const filteredLines = filter?.kind === "line" ? filter.lines : [];
	const singleLine = filteredLines.length === 1 ? filteredLines[0] : undefined;

	const toggleLine = (line: Line) => {
		if (filter?.network === undefined) return;
		const selected = filteredLines.some(({ id }) => id === line.id);
		if (!selected && filteredLines.length >= MAX_FILTERED_LINES) return;

		const order = new Map(lines.map(({ id }, index) => [id, index]));
		const nextLines = selected
			? filteredLines.filter(({ id }) => id !== line.id)
			: [...filteredLines, line].toSorted(
					(a, b) => (order.get(a.id) ?? Number.POSITIVE_INFINITY) - (order.get(b.id) ?? Number.POSITIVE_INFINITY),
				);
		onFilterChange(
			nextLines.length > 0
				? { kind: "line", network: filter.network, lines: nextLines }
				: { kind: "network", network: filter.network },
		);
	};

	const linesToggleLabel = filter?.kind === "line" ? m.map_filter_change_line() : m.map_filter_choose_line();
	const linesToggle = lines.length > 0 && (
		<button
			aria-controls={linesPanelId}
			aria-expanded={linesOpen}
			data-slot="map-filter-button"
			className={clsx(
				subtleActionClassName,
				"gap-1 h-7 px-1.5 sm:px-2 text-sm aria-expanded:bg-branding aria-expanded:text-branding-foreground",
			)}
			onClick={() => setLinesOpen((open) => !open)}
			title={linesToggleLabel}
			type="button"
		>
			<ListIcon aria-hidden="true" className="shrink-0 size-4" />
			<span className="hidden sm:inline">{linesToggleLabel}</span>
			<ChevronDownIcon
				aria-hidden="true"
				className={clsx("shrink-0 size-3.5 transition-transform", linesOpen && "rotate-180")}
			/>
		</button>
	);

	useEffect(() => {
		if (!linesOpen) return;

		const onPointerDown = (event: PointerEvent) => {
			if (!activatorRef.current?.contains(event.target as Node)) setLinesOpen(false);
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setLinesOpen(false);
		};
		document.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
		};
	}, [linesOpen]);

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
			<div className="maplibregl-ctrl relative z-10 max-w-[calc(100vw-6.5rem)] font-sans" ref={activatorRef}>
				{filter ? (
					<div className="relative min-w-0 rounded-lg bg-card text-card-foreground shadow-md ring-2 ring-card">
						<div className="flex items-center gap-1.5 h-9 min-w-0 overflow-hidden pl-1 pr-1">
							<button
								className={clsx(subtleActionClassName, "size-7")}
								data-slot="map-filter-button"
								onClick={() => {
									setLinesOpen(false);
									onFilterChange(undefined);
								}}
								title={m.map_filter_disable()}
								type="button"
							>
								<FilterXIcon className="size-4.5" />
							</button>

							{filter.kind === "network" ? (
								<>
									<NetworkBadge network={filter.network} />
									{linesToggle}
								</>
							) : (
								<>
									{filter.network ? (
										<>
											<NetworkBadge network={filter.network} />
											{linesToggle}
											<ChevronRight className="shrink-0 size-3 text-muted-foreground" />
										</>
									) : null}

									<LineBadges lines={filter.lines} />
								</>
							)}

							<FilterModuleVehiclesCount filter={filter} fixedNetworkId={fixedNetworkId} />

							{filter.kind === "line" && <FilterModuleLineAlerts lines={filter.lines} />}

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
									singleLine !== undefined && (
										<Link
											className={clsx(subtleActionClassName, "gap-1.5 h-7 px-1.5 sm:px-2.5 text-sm")}
											params={{ lineId: `${singleLine.id}` }}
											title={m.map_filter_line_data()}
											to="/data/lines/$lineId"
										>
											<HistoryIcon className="shrink-0 size-4" />
											<span className="hidden sm:inline">{m.map_filter_line_data()}</span>
										</Link>
									)
								))}
						</div>
						{filter.network !== undefined && lines.length > 0 && (
							<NetworkLinesPanel
								currentLineIds={filteredLines.map((line) => line.id)}
								id={linesPanelId}
								lines={lines}
								network={filter.network}
								onNavigate={() => setLinesOpen(false)}
								onToggleLine={toggleLine}
								open={linesOpen}
							/>
						)}
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

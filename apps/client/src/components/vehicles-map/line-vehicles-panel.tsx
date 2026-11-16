import type { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { clsx } from "clsx";
import { ChevronRightIcon, ChevronUpIcon, HistoryIcon, InfoIcon } from "lucide-react";
import { useQueryState } from "nuqs";
import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { match } from "ts-pattern";
import { useMediaQuery } from "usehooks-ts";

import { useMap } from "~/adapters/maplibre-gl/map";
import { GetLineOnlineJourneysQuery, GetLineOnlineVehiclesQuery, type LineOnlineJourney } from "~/api/lines";
import { Drawer, DrawerContent, DrawerTitle } from "~/components/ui/drawer";
import { useDisplayedPositionTypes } from "~/components/vehicles-map/displayed-position-types";
import { registerMapBottomOverlay } from "~/components/vehicles-map/map-bottom-overlay";
import { BusIcon, CoachIcon, GondolaIcon, ShipIcon, TramwayIcon, TrolleybusIcon } from "~/icons/means-of-transport";
import * as m from "~/paraglide/messages";
import { dayjsTz } from "~/utils/timezone";

type LineVehiclesPanelProps = {
	lineId: number;
	rail?: boolean;
	timezone?: string;
};

type LineVehicles = NonNullable<ReturnType<typeof useLineVehicles>>;

/** Véhicules identifiés en ligne, par numéro. */
function useLineVehicles(lineId: number | undefined) {
	const { data: vehicles } = useQuery(GetLineOnlineVehiclesQuery(lineId));
	return (
		vehicles
			?.filter((v) => v.activity.status === "online" && v.activity.markerId !== undefined)
			.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })) ?? []
	);
}

function useLineJourneys(lineId: number | undefined) {
	const [positionTypes] = useDisplayedPositionTypes();
	const { data: journeys } = useQuery(GetLineOnlineJourneysQuery(lineId, positionTypes));
	return journeys ?? [];
}

type LinePanelEntries = { kind: "vehicles"; items: LineVehicles } | { kind: "trains"; items: LineOnlineJourney[] };

function useLinePanelEntries(lineId: number, rail: boolean): LinePanelEntries {
	const vehicles = useLineVehicles(rail ? undefined : lineId);
	const journeys = useLineJourneys(rail ? lineId : undefined);
	return rail ? { kind: "trains", items: journeys } : { kind: "vehicles", items: vehicles };
}

function linePanelTitle({ kind, items }: LinePanelEntries) {
	return kind === "trains"
		? m.map_trains_running({ count: items.length })
		: m.map_vehicles_online({ count: items.length });
}

type LineVehiclesListProps = {
	vehicles: LineVehicles;
	timezone?: string;
	/** Lignes et boutons plus larges, pour le doigt plutôt que le pointeur. */
	touch?: boolean;
	className?: string;
};

function VehicleTypeIcon({ type }: Readonly<{ type: LineVehicles[number]["type"] }>) {
	const className = "size-5";
	return match(type)
		.with("SUBWAY", "TRAMWAY", "RAIL", () => <TramwayIcon className={className} />)
		.with("TROLLEY", () => <TrolleybusIcon className={className} />)
		.with("COACH", () => <CoachIcon className={className} />)
		.with("FERRY", () => <ShipIcon className={className} />)
		.with("GONDOLA", () => <GondolaIcon className={className} />)
		.otherwise(() => <BusIcon className={className} />);
}

function EmptyNotice({ message, className }: Readonly<{ message: string; className?: string }>) {
	return (
		<div className={clsx("p-3", className)}>
			<p className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
				<InfoIcon className="size-4 shrink-0" />
				{message}
			</p>
		</div>
	);
}

function LineVehiclesList({ vehicles, timezone, touch = false, className }: Readonly<LineVehiclesListProps>) {
	const [, setMarkerId] = useQueryState("marker-id");

	if (vehicles.length === 0) {
		return <EmptyNotice className={className} message={m.map_vehicles_online_empty()} />;
	}

	return (
		<ul className={clsx("overflow-y-auto overscroll-contain py-1", className)}>
			{vehicles.map((vehicle) => (
				<li key={vehicle.id} className="flex items-center gap-1.5 px-2 py-0.5">
					<button
						aria-label={m.map_vehicle_locate_label({ number: vehicle.number })}
						className={clsx(
							"flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-branding/50",
							touch ? "min-h-13 py-1.5" : "min-h-12 py-1",
						)}
						data-slot="map-panel-row"
						title={m.map_vehicle_locate()}
						type="button"
						onClick={() => setMarkerId(vehicle.activity.markerId!)}
					>
						<span
							aria-hidden="true"
							className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
						>
							<VehicleTypeIcon type={vehicle.type} />
						</span>
						<span aria-hidden="true" className="grid min-w-0 flex-1 gap-0.5">
							<span className="flex min-w-0 items-baseline gap-1.5">
								<span className="truncate text-sm font-semibold leading-tight">n°{vehicle.number}</span>
								{vehicle.activity.since && (
									<span className="shrink-0 text-xs leading-tight text-muted-foreground tabular-nums">
										{m.map_vehicle_since()} {dayjsTz(vehicle.activity.since, timezone).format("HH:mm")}
									</span>
								)}
							</span>
							{vehicle.designation && (
								<span className="truncate text-xs leading-tight text-muted-foreground">{vehicle.designation}</span>
							)}
						</span>
					</button>
					<span aria-hidden="true" className="h-7 w-px shrink-0 bg-border" />
					<Link
						aria-label={m.map_vehicle_history_label({ number: vehicle.number })}
						className={clsx(
							"flex shrink-0 items-center justify-center rounded-md bg-branding/10 text-branding transition-colors outline-none hover:bg-branding hover:text-branding-foreground focus-visible:ring-2 focus-visible:ring-branding/50 dark:bg-branding/40 dark:text-branding-foreground dark:hover:bg-branding",
							touch ? "size-9" : "size-8",
						)}
						params={{ vehicleId: String(vehicle.id) }}
						title={m.map_vehicle_history()}
						to="/data/vehicles/$vehicleId"
					>
						<HistoryIcon className="size-4" />
					</Link>
				</li>
			))}
		</ul>
	);
}

function TrainCallTime({
	time,
	timezone,
	className,
}: Readonly<{ time?: string; timezone?: string; className?: string }>) {
	return (
		<span className={clsx("text-xs text-muted-foreground tabular-nums", className)}>
			{time ? dayjsTz(time, timezone).format("HH:mm") : "--:--"}
		</span>
	);
}

function TrainPositionMarker({ className }: Readonly<{ className?: string }>) {
	return (
		<span
			className={clsx(
				"absolute top-1/2 flex size-3.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-branding text-branding-foreground ring-2 ring-popover dark:bg-[color-mix(in_oklab,var(--color-branding),white_40%)]",
				className,
			)}
		>
			<ChevronRightIcon className="size-2.5 translate-x-px" strokeWidth={4} />
		</span>
	);
}

type TrainRouteProps = { monitored: boolean; running: boolean; atStop: boolean };

function TrainRoute({ monitored, running, atStop }: Readonly<TrainRouteProps>) {
	const traveledClassName = running ? "border-muted-foreground/60" : "border-transparent";
	return (
		<span className="flex h-2.5 items-center">
			{monitored ? (
				<>
					<span
						className={clsx(
							"relative shrink-0 self-center border-t-2 border-dotted",
							running ? "w-9" : "w-5",
							traveledClassName,
						)}
					>
						{!atStop && <TrainPositionMarker className="left-1/2" />}
					</span>
					<span className="relative size-2 shrink-0 rounded-full border-2 border-foreground">
						{atStop && <TrainPositionMarker className="left-1/2" />}
					</span>
					<span className="h-0.5 flex-1 bg-foreground" />
					<span className="size-2 shrink-0 rounded-full bg-foreground" />
				</>
			) : (
				<>
					<span className={clsx("relative flex-1 border-t-2 border-dotted", traveledClassName)}>
						{!atStop && (
							<TrainPositionMarker className={running ? "left-[calc(100%-2rem)]" : "left-[calc(100%-0.75rem)]"} />
						)}
					</span>
					<span className="relative size-2 shrink-0 rounded-full bg-foreground">
						{atStop && <TrainPositionMarker className="left-1/2" />}
					</span>
				</>
			)}
		</span>
	);
}

const DIRECTION_ORDER = ["OUTBOUND", "INBOUND", "UNKNOWN"] as const;

function groupJourneysByDirection(journeys: LineOnlineJourney[]) {
	return DIRECTION_ORDER.map((direction) => {
		const grouped = journeys.filter((journey) => (journey.direction ?? "UNKNOWN") === direction);
		const destinations = [...new Set(grouped.flatMap((journey) => journey.destination ?? []))].sort((a, b) =>
			a.localeCompare(b),
		);
		return { direction, destinations, journeys: grouped };
	}).filter((group) => group.journeys.length > 0);
}

type LineTrainsListProps = Omit<LineVehiclesListProps, "vehicles"> & { journeys: LineOnlineJourney[] };

function LineTrainsList({ journeys, timezone, touch = false, className }: Readonly<LineTrainsListProps>) {
	const [, setMarkerId] = useQueryState("marker-id");

	if (journeys.length === 0) {
		return <EmptyNotice className={className} message={m.map_trains_running_empty()} />;
	}

	return (
		<ul
			className={clsx(
				"grid grid-cols-[auto_minmax(0,1fr)] content-start overflow-y-auto overscroll-contain pb-1",
				className,
			)}
		>
			{groupJourneysByDirection(journeys).map(({ direction, destinations, journeys }) => (
				<Fragment key={direction}>
					<li className="sticky top-0 z-10 col-span-full bg-popover px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground">
						<p className="truncate">→ {destinations.join(", ") || "—"}</p>
					</li>
					{journeys.map((journey) => (
						<li key={journey.id} className="col-span-full grid grid-cols-subgrid px-2 py-0.5">
							<button
								aria-label={m.map_train_locate_label({ number: journey.number ?? journey.destination ?? "" })}
								className={clsx(
									"col-span-full grid grid-cols-subgrid items-center gap-x-2.5 rounded-lg px-2 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-branding/50",
									touch ? "min-h-13 py-1.5" : "min-h-12 py-1",
								)}
								data-slot="map-panel-row"
								title={m.map_vehicle_locate()}
								type="button"
								onClick={() => setMarkerId(journey.id)}
							>
								<span
									aria-hidden="true"
									className="flex items-center self-stretch border-r pr-2.5 text-base leading-none font-bold tracking-tight tabular-nums"
								>
									{journey.number ? (
										<span className="truncate">{journey.number}</span>
									) : (
										<span className="text-muted-foreground/60">
											<VehicleTypeIcon type="RAIL" />
										</span>
									)}
								</span>
								<span aria-hidden="true" className="grid min-w-0 gap-y-1 text-sm leading-tight">
									<span className={clsx("grid grid-cols-2 gap-x-3", journey.running ? "pl-9" : "pl-5")}>
										{journey.monitoredStop ? (
											<TrainCallTime time={journey.departureTime} timezone={timezone} />
										) : (
											<span />
										)}
										<TrainCallTime className="text-right" time={journey.arrivalTime} timezone={timezone} />
									</span>
									<TrainRoute
										atStop={journey.atStop}
										monitored={journey.monitoredStop !== undefined}
										running={journey.running}
									/>
									<span className={clsx("grid grid-cols-2 gap-x-3", journey.running ? "pl-9" : "pl-5")}>
										<span className="truncate text-muted-foreground">{journey.monitoredStop}</span>
										<span
											className={clsx(
												"truncate text-right",
												journey.destination ? "font-medium" : "text-muted-foreground",
											)}
										>
											{journey.destination ?? "—"}
										</span>
									</span>
								</span>
							</button>
						</li>
					))}
				</Fragment>
			))}
		</ul>
	);
}

function LinePanelList({
	entries,
	...props
}: Readonly<Omit<LineVehiclesListProps, "vehicles"> & { entries: LinePanelEntries }>) {
	return entries.kind === "trains" ? (
		<LineTrainsList journeys={entries.items} {...props} />
	) : (
		<LineVehiclesList vehicles={entries.items} {...props} />
	);
}

function LiveDot() {
	return <span aria-hidden="true" className="size-2 shrink-0 animate-pulse rounded-full bg-green-500" />;
}

/** Sur grand écran : panneau en surimpression de la carte, en bas à droite. */
function LineVehiclesControl({ lineId, rail = false, timezone }: Readonly<LineVehiclesPanelProps>) {
	const map = useMap();
	const containerRef = useRef(document.createElement("div"));
	const entries = useLinePanelEntries(lineId, rail);

	useEffect(() => {
		const container = containerRef.current;
		container.className = "maplibregl-ctrl maplibregl-ctrl-group font-sans line-vehicles-control";

		const control = {
			onAdd: () => container,
			onRemove: () => void 0,
		};

		map.addControl(control, "bottom-right");
		const parent = container.parentElement;
		if (parent) {
			parent.style.zIndex = "10";
			parent.insertBefore(container, parent.querySelector(":scope > .maplibregl-ctrl-attrib"));
		}
		return () => {
			map.removeControl(control);
		};
	}, [map]);

	return createPortal(
		<div className="w-96 max-w-[calc(100dvw-20px)] overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10">
			<div className="flex h-10 items-center gap-2.5 border-b px-3">
				<LiveDot />
				<h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{linePanelTitle(entries)}</h2>
			</div>
			<LinePanelList className="max-h-60" entries={entries} timezone={timezone} />
		</div>,
		containerRef.current,
	);
}

/**
 * Hauteur du drawer replié : la poignée (8 px de marge, 6 px de haut) et l'en-tête (40 px), seuls à
 * dépasser du bas de l'écran.
 */
const COLLAPSED_SNAP_POINT = "54px";
const EXPANDED_SNAP_POINT = 1;
const SNAP_POINTS = [COLLAPSED_SNAP_POINT, EXPANDED_SNAP_POINT];

/**
 * Sur petit écran : drawer en bas de l'écran, replié sur son en-tête tant que le filtre est posé. On
 * le déplie en touchant l'en-tête ou en le faisant glisser vers le haut. Il ne se ferme pas : c'est
 * retirer le filtre qui le fait disparaître. Comme celui des prochains passages, il n'est pas modal.
 */
function LineVehiclesDrawer({ lineId, rail = false, timezone }: Readonly<LineVehiclesPanelProps>) {
	const entries = useLinePanelEntries(lineId, rail);
	const [snapPoint, setSnapPoint] = useState<DrawerPrimitive.Root.SnapPoint | null>(COLLAPSED_SNAP_POINT);
	const expanded = snapPoint === EXPANDED_SNAP_POINT;

	return (
		<Drawer
			disablePointerDismissal
			modal={false}
			open
			// Un glissement vers le bas depuis la position repliée demanderait sa fermeture : on l'annule, le
			// drawer revient se replier.
			onOpenChange={(open, eventDetails) => {
				if (!open) eventDetails.cancel();
			}}
			snapPoint={snapPoint}
			snapPoints={SNAP_POINTS}
			onSnapPointChange={setSnapPoint}
		>
			<DrawerContent
				// Hauteur fixe, et position repliée calculée ici plutôt que par Base UI : celui-ci la déduit de
				// hauteurs qu'il ne mesure qu'après l'apparition du drawer, et le montrerait jusque-là déplié —
				// il s'ouvrirait un instant avant de revenir se replier. Le décalage replié reprend la hauteur du
				// drawer moins `COLLAPSED_SNAP_POINT`.
				className={clsx(
					"h-[45dvh] max-h-[45dvh]",
					expanded
						? "translate-y-(--drawer-swipe-movement-y)"
						: "translate-y-[calc(45dvh-54px+var(--drawer-swipe-movement-y,0px))]",
				)}
				ref={registerMapBottomOverlay}
				showOverlay={false}
			>
				<button
					aria-expanded={expanded}
					className="flex h-10 shrink-0 items-center gap-2.5 border-b px-3 text-left"
					type="button"
					onClick={() => setSnapPoint(expanded ? COLLAPSED_SNAP_POINT : EXPANDED_SNAP_POINT)}
				>
					<LiveDot />
					<DrawerTitle className="min-w-0 flex-1 truncate text-sm font-semibold">{linePanelTitle(entries)}</DrawerTitle>
					<ChevronUpIcon
						className={clsx("size-5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
					/>
				</button>
				<LinePanelList
					className="min-h-0 flex-1 pb-6 mask-b-from-[calc(100%-1.5rem)]"
					entries={entries}
					timezone={timezone}
					touch
				/>
			</DrawerContent>
		</Drawer>
	);
}

/**
 * Véhicules identifiés en ligne sur la ligne filtrée, ou trains en circulation sur une ligne
 * ferroviaire : panneau sur grand écran, drawer sur petit.
 */
export function LineVehiclesPanel(props: LineVehiclesPanelProps) {
	const isDesktop = useMediaQuery("(min-width: 640px)");
	if (isDesktop) return <LineVehiclesControl {...props} />;
	// Non modal, le drawer pose des gardes de focus à l'endroit où il est rendu, et non dans son portail :
	// dans le conteneur de la carte, dont MapLibre réordonne les enfants, React ne s'y retrouverait plus.
	return createPortal(<LineVehiclesDrawer {...props} />, document.body);
}

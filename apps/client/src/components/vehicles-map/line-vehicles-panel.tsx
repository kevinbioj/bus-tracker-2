import type { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { clsx } from "clsx";
import { ChevronUpIcon, HistoryIcon, InfoIcon } from "lucide-react";
import { useQueryState } from "nuqs";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { match } from "ts-pattern";
import { useMediaQuery } from "usehooks-ts";

import { useMap } from "~/adapters/maplibre-gl/map";
import { GetLineOnlineVehiclesQuery } from "~/api/lines";
import { Drawer, DrawerContent, DrawerTitle } from "~/components/ui/drawer";
import { registerMapBottomOverlay } from "~/components/vehicles-map/map-bottom-overlay";
import { BusIcon, CoachIcon, GondolaIcon, ShipIcon, TramwayIcon, TrolleybusIcon } from "~/icons/means-of-transport";
import * as m from "~/paraglide/messages";
import { dayjsTz } from "~/utils/timezone";

type LineVehiclesPanelProps = {
	lineId: number;
	timezone?: string;
};

type LineVehicles = NonNullable<ReturnType<typeof useLineVehicles>>;

/** Véhicules identifiés en ligne, par numéro. */
function useLineVehicles(lineId: number) {
	const { data: vehicles } = useQuery(GetLineOnlineVehiclesQuery(lineId));
	return (
		vehicles
			?.filter((v) => v.activity.status === "online" && v.activity.markerId !== undefined)
			.sort((a, b) => a.number.localeCompare(b.number)) ?? []
	);
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

function LineVehiclesList({ vehicles, timezone, touch = false, className }: Readonly<LineVehiclesListProps>) {
	const [, setMarkerId] = useQueryState("marker-id");

	if (vehicles.length === 0) {
		return (
			<div className={clsx("p-3", className)}>
				<p className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
					<InfoIcon className="size-4 shrink-0" />
					{m.map_vehicles_online_empty()}
				</p>
			</div>
		);
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

function LiveDot() {
	return <span aria-hidden="true" className="size-2 shrink-0 animate-pulse rounded-full bg-green-500" />;
}

/** Sur grand écran : panneau en surimpression de la carte, en bas à droite. */
function LineVehiclesControl({ lineId, timezone }: Readonly<LineVehiclesPanelProps>) {
	const map = useMap();
	const containerRef = useRef(document.createElement("div"));
	const vehicles = useLineVehicles(lineId);

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
				<h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
					{m.map_vehicles_online({ count: vehicles.length })}
				</h2>
			</div>
			<LineVehiclesList className="max-h-60" timezone={timezone} vehicles={vehicles} />
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
function LineVehiclesDrawer({ lineId, timezone }: Readonly<LineVehiclesPanelProps>) {
	const vehicles = useLineVehicles(lineId);
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
					<DrawerTitle className="min-w-0 flex-1 truncate text-sm font-semibold">
						{m.map_vehicles_online({ count: vehicles.length })}
					</DrawerTitle>
					<ChevronUpIcon
						className={clsx("size-5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
					/>
				</button>
				<LineVehiclesList
					className="min-h-0 flex-1 pb-6 mask-b-from-[calc(100%-1.5rem)]"
					timezone={timezone}
					touch
					vehicles={vehicles}
				/>
			</DrawerContent>
		</Drawer>
	);
}

/** Véhicules identifiés en ligne sur la ligne filtrée : panneau sur grand écran, drawer sur petit. */
export function LineVehiclesPanel(props: LineVehiclesPanelProps) {
	const isDesktop = useMediaQuery("(min-width: 640px)");
	if (isDesktop) return <LineVehiclesControl {...props} />;
	// Non modal, le drawer pose des gardes de focus à l'endroit où il est rendu, et non dans son portail :
	// dans le conteneur de la carte, dont MapLibre réordonne les enfants, React ne s'y retrouverait plus.
	return createPortal(<LineVehiclesDrawer {...props} />, document.body);
}

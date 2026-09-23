import type { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { clsx } from "clsx";
import { ChevronUpIcon, HistoryIcon, LocateIcon } from "lucide-react";
import { useQueryState } from "nuqs";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { match } from "ts-pattern";
import { useMediaQuery } from "usehooks-ts";

import { useMap } from "~/adapters/maplibre-gl/map";
import { GetLineOnlineVehiclesQuery } from "~/api/lines";
import { Button } from "~/components/ui/button";
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

function LineVehiclesList({ vehicles, timezone, touch = false, className }: Readonly<LineVehiclesListProps>) {
	const [, setMarkerId] = useQueryState("marker-id");
	const buttonClassName = clsx("shrink-0", touch ? "size-8" : "size-7");

	if (vehicles.length === 0) {
		return (
			<p className={clsx("px-2 py-3 text-center text-sm text-muted-foreground", className)}>
				{m.map_vehicles_online_empty()}
			</p>
		);
	}

	return (
		<ul className={clsx("overflow-y-auto overscroll-contain divide-y", className)}>
			{vehicles.map((vehicle) => {
				const vehicleIcon = match(vehicle.type)
					.with("SUBWAY", "TRAMWAY", "RAIL", () => <TramwayIcon className="align-top inline size-4" />)
					.with("TROLLEY", () => <TrolleybusIcon className="align-top inline size-4" />)
					.with("COACH", () => <CoachIcon className="align-top inline size-4" />)
					.with("FERRY", () => <ShipIcon className="align-top inline size-4" />)
					.with("GONDOLA", () => <GondolaIcon className="align-top inline size-4" />)
					.otherwise(() => <BusIcon className="align-top inline size-4" />);

				return (
					<li key={vehicle.id} className={clsx("flex items-center gap-1 py-1", touch ? "px-3" : "px-2")}>
						<div className="flex-1 min-w-0">
							<div className="text-sm font-medium truncate">
								<span className="font-bold">
									{vehicleIcon} n°{vehicle.number}
								</span>
								{vehicle.activity.since && (
									<span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
										{m.map_vehicle_since()} {dayjsTz(vehicle.activity.since, timezone).format("HH:mm")}
									</span>
								)}
							</div>
							{vehicle.designation && <div className="text-wrap">{vehicle.designation}</div>}
						</div>
						<Button
							className={buttonClassName}
							size="icon"
							title={m.map_vehicle_locate()}
							type="button"
							variant="ghost"
							onClick={() => setMarkerId(vehicle.activity.markerId!)}
						>
							<LocateIcon className="size-4 m-auto" />
						</Button>
						<Button
							className={buttonClassName}
							size="icon"
							variant="ghost"
							nativeButton={false}
							render={
								<Link
									title={m.map_vehicle_history()}
									to="/data/vehicles/$vehicleId"
									params={{ vehicleId: String(vehicle.id) }}
								>
									<HistoryIcon className="size-4 m-auto" />
								</Link>
							}
						/>
					</li>
				);
			})}
		</ul>
	);
}

/** Sur grand écran : panneau en surimpression de la carte, en bas à droite. */
function LineVehiclesControl({ lineId, timezone }: Readonly<LineVehiclesPanelProps>) {
	const map = useMap();
	const containerRef = useRef(document.createElement("div"));
	const vehicles = useLineVehicles(lineId);

	useEffect(() => {
		const container = containerRef.current;
		container.className = "maplibregl-ctrl maplibregl-ctrl-group font-sans";

		const control = {
			onAdd: () => container,
			onRemove: () => void 0,
		};

		map.addControl(control, "bottom-right");
		const parent = container.parentElement;
		if (parent) parent.style.zIndex = "10";
		return () => {
			map.removeControl(control);
		};
	}, [map]);

	return createPortal(
		<div className="bg-background/95 backdrop-blur-sm rounded-sm shadow-lg border overflow-hidden w-96 max-w-[calc(100dvw-20px)]">
			<div className="px-2 py-2 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
				{m.map_vehicles_online({ count: vehicles.length })}
			</div>
			<LineVehiclesList className="max-h-52" timezone={timezone} vehicles={vehicles} />
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
					className="flex h-10 shrink-0 items-center gap-2 border-b px-3 text-left"
					type="button"
					onClick={() => setSnapPoint(expanded ? COLLAPSED_SNAP_POINT : EXPANDED_SNAP_POINT)}
				>
					<DrawerTitle className="min-w-0 flex-1 truncate text-sm font-semibold">
						{m.map_vehicles_online({ count: vehicles.length })}
					</DrawerTitle>
					<ChevronUpIcon
						className={clsx("size-5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")}
					/>
				</button>
				<LineVehiclesList className="min-h-0 flex-1 pb-2" timezone={timezone} touch vehicles={vehicles} />
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

import type { StopCallDirection } from "@bus-tracker/contracts";
import { useQueries, useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import dayjs from "dayjs";
import { ArrowRightLeftIcon, XIcon } from "lucide-react";
import { useQueryState } from "nuqs";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMediaQuery } from "usehooks-ts";

import { useMap } from "~/adapters/maplibre-gl/map";
import { GetNetworkQuery } from "~/api/networks";
import { isRealtimeAvailable, sendRealtimeMessage, useRealtimeStatus } from "~/api/realtime";
import { GetStopAlertsQuery } from "~/api/service-alerts";
import { GetStopDeparturesQuery } from "~/api/stops";
import { ServiceAlertsButton } from "~/components/service-alerts/service-alerts-button";
import { TapTooltip } from "~/components/tap-tooltip";
import { Button } from "~/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from "~/components/ui/drawer";
import { useShowWheelchairAccessibility } from "~/components/vehicles-map/accessibility-display";
import { DeparturesList, formatDepartureLabel } from "~/components/vehicles-map/departure-row";
import { registerMapBottomOverlay } from "~/components/vehicles-map/map-bottom-overlay";
import { useNextCallsDisplayMode } from "~/components/vehicles-map/next-calls-display-mode";
import { SELECTED_STOP_ICON_SCALE, STOP_PLATE_CENTER_OFFSET } from "~/components/vehicles-map/stops-markers/stop-icon";
import { useStopSelection } from "~/components/vehicles-map/stops-markers/stop-selection";
import { useDebouncedMemo } from "~/hooks/use-debounced-memo";
import { getWheelchairStatus, WheelchairIcon, wheelchairIconDetails } from "~/icons/wheelchair";
import * as m from "~/paraglide/messages";

/**
 * Prochains passages de l'arrêt sélectionné, lignes du réseau comprises, prêts à afficher — communs
 * au panneau et au drawer. Un réseau imposé (carte embarquée) restreint le tableau à ses lignes, des
 * lignes filtrées à elles seules.
 */
function useStopDepartures({ networkId, lineIds }: StopDeparturesPanelProps) {
	const { selectedRef } = useStopSelection();
	const [displayMode] = useNextCallsDisplayMode();
	const [showWheelchairAccessibility] = useShowWheelchairAccessibility();

	// Départs par défaut ; un autre arrêt choisi y revient.
	const [direction, setDirection] = useState<StopCallDirection>("departures");
	const [directionStopRef, setDirectionStopRef] = useState(selectedRef);
	if (directionStopRef !== selectedRef) {
		setDirectionStopRef(selectedRef);
		setDirection("departures");
	}
	const toggleDirection = () => setDirection((current) => (current === "departures" ? "arrivals" : "departures"));

	const realtimeStatus = useRealtimeStatus();
	const realtime = isRealtimeAvailable(realtimeStatus);
	const connected = realtimeStatus === "open";

	useEffect(() => {
		if (!connected || selectedRef === null) return;
		sendRealtimeMessage({ type: "watch-stop", stop: { ref: selectedRef, direction, lineIds } });
		return () => {
			sendRealtimeMessage({ type: "watch-stop", stop: null });
		};
	}, [connected, selectedRef, direction, lineIds]);

	const { data, isError, isPending } = useQuery(GetStopDeparturesQuery(selectedRef, direction, lineIds, realtime));
	const { data: alerts } = useQuery(GetStopAlertsQuery(selectedRef, realtime));
	// Les lignes des réseaux de la station, pour leur numéro, leurs couleurs et leur pictogramme : une
	// requête au plus toutes les 5 min par réseau, souvent déjà en cache — le module de filtre fait la
	// même. Une gare peut en réunir plusieurs (TER, Intercités, TGV…), et une ligne peut relever d'un
	// réseau que la station ne déclare pas : ceux des passages s'y ajoutent. Un réseau imposé est seul
	// chargé : les passages des autres, dont la ligne reste inconnue, sont écartés du tableau.
	const networkIds =
		networkId !== undefined
			? [networkId]
			: [
					...new Set([
						...(data?.stop.networkIds ?? []),
						...(data?.departures.flatMap(({ lineNetworkId }) => (lineNetworkId !== undefined ? [lineNetworkId] : [])) ??
							[]),
					]),
				].toSorted((a, b) => a - b);
	const { linesById, isPending: areLinesPending } = useQueries({
		queries: networkIds.map((networkId) => GetNetworkQuery(networkId, true)),
		combine: (networks) => ({
			linesById: new Map(
				networks.flatMap(({ data: network }) => network?.lines.map((line) => [line.id, line] as const) ?? []),
			),
			isPending: networks.some(({ isPending }) => isPending),
		}),
	});

	// Quai choisi sur la carte au zoom le plus fort : le serveur a déjà restreint le tableau à ce quai.
	const stopPoint = data?.stop.stopPoints.find((point) => point.ref === data.stopPointRef);

	// Seules les stations dont la source le prévoit proposent leurs arrivées. Le tableau le dit : c'est
	// retenu pendant que se charge celui de l'autre sens.
	const [reversibleStopRef, setReversibleStopRef] = useState<string | null>(null);
	if (data !== undefined) {
		const nextReversibleStopRef = data.stop.arrivals ? selectedRef : null;
		if (nextReversibleStopRef !== reversibleStopRef) setReversibleStopRef(nextReversibleStopRef);
	}
	const reversible = selectedRef !== null && reversibleStopRef === selectedRef;
	// Accessibilité du quai choisi, sinon de la station lorsque tous ses quais s'accordent : une station
	// dont les quais diffèrent, ou dont l'un est inconnu, est présentée comme inconnue.
	const wheelchairBoardings = stopPoint !== undefined ? [stopPoint] : (data?.stop.stopPoints ?? []);
	const wheelchairStatus = getWheelchairStatus(
		wheelchairBoardings.every((point) => point.wheelchairBoarding === wheelchairBoardings[0]?.wheelchairBoarding)
			? wheelchairBoardings[0]?.wheelchairBoarding
			: undefined,
	);
	const stopPointsByRef = new Map(data?.stop.stopPoints.map((point) => [point.ref, point]));
	const departures = data?.departures ?? [];

	// Les libellés relatifs vieillissent seuls entre deux rafraîchissements : on les recalcule au
	// même rythme que les prochains arrêts d'une course.
	const labels = useDebouncedMemo(
		() => {
			const now = dayjs();
			return departures.map((departure) => formatDepartureLabel(departure, displayMode, now));
		},
		5_000,
		[departures, displayMode],
	);

	// Seuls s'affichent les passages dont la ligne est connue : sans elle, le pictogramme ne serait
	// qu'un « ? ». Les libellés restent calculés sur la liste entière, dont ils suivent les indices.
	// Deux passages peuvent partager ligne, heure et quai sans être rattachés à une course suivie : un
	// rang d'occurrence départage leur clé. Des clés en double laisseraient React garder à l'écran des
	// lignes d'un tableau précédent.
	const keyOccurrences = new Map<string, number>();
	const rows = departures.flatMap((departure, index) => {
		const line = departure.lineId !== undefined ? linesById.get(departure.lineId) : undefined;
		if (line === undefined) return [];

		const baseKey = `${departure.journeyId ?? departure.lineId}-${departure.aimedTime}-${departure.stopRef}`;
		const occurrence = keyOccurrences.get(baseKey) ?? 0;
		keyOccurrences.set(baseKey, occurrence + 1);

		// L'accessibilité du véhicule n'importe que si l'on peut monter depuis le quai : celui du passage,
		// la station à défaut lorsque ce quai n'est pas connu. Un quai d'accessibilité inconnue n'écarte
		// pas le véhicule : on dit alors s'il est accessible ou non, sans afficher un second inconnu.
		const stopBoarding = stopPointsByRef.get(departure.stopRef)?.wheelchairBoarding;
		const stopWheelchairStatus = stopBoarding === undefined ? wheelchairStatus : getWheelchairStatus(stopBoarding);
		const tripWheelchairStatus = getWheelchairStatus(departure.wheelchairAccessible);
		const vehicleWheelchairStatus =
			showWheelchairAccessibility &&
			(stopWheelchairStatus === "accessible" ||
				(stopWheelchairStatus === "unknown" && tripWheelchairStatus !== "unknown"))
				? tripWheelchairStatus
				: undefined;

		return [
			{
				departure,
				line,
				label: labels[index] ?? "",
				wheelchairStatus: vehicleWheelchairStatus,
				// Au tableau d'un quai, la course s'y arrête bel et bien : l'arrêt n'y est que provisoire.
				relocated: departure.relocated === true && stopPoint === undefined,
				key: `${baseKey}-${occurrence}`,
			},
		];
	});

	return {
		selectedRef,
		direction,
		reversible,
		toggleDirection,
		stopName: stopPoint?.name ?? data?.stop.name,
		stopPoint,
		// Tant que le tableau n'est pas chargé, l'accessibilité n'est pas inconnue : elle n'est pas encore là.
		wheelchairStatus: showWheelchairAccessibility && data !== undefined ? wheelchairStatus : undefined,
		// Point à montrer sur la carte : le quai choisi, la station sinon.
		location: data === undefined ? undefined : (stopPoint ?? data.stop),
		rows,
		alerts: alerts ?? [],
		isError,
		isLoading: isPending || areLinesPending,
	};
}

type StopDeparturesState = ReturnType<typeof useStopDepartures>;

type StopDeparturesListProps = Pick<StopDeparturesState, "direction" | "rows" | "isError" | "isLoading"> & {
	touch?: boolean;
	scrollClassName: string;
	onLocate: (journeyId: string) => void;
};

function StopDeparturesList({ direction, ...props }: Readonly<StopDeparturesListProps>) {
	const arrivals = direction === "arrivals";
	return (
		<DeparturesList
			direction={direction}
			messages={{
				error: arrivals ? m.stop_arrivals_error() : m.stop_departures_error(),
				loading: arrivals ? m.stop_arrivals_loading() : m.stop_departures_loading(),
				empty: arrivals ? m.stop_arrivals_empty() : m.stop_departures_empty(),
			}}
			{...props}
		/>
	);
}

/** Nom de l'arrêt, suivi du quai s'il y en a un de choisi et de son accessibilité. */
function StopName({
	stopName,
	stopPoint,
	wheelchairStatus,
	className,
}: Readonly<Pick<StopDeparturesState, "stopName" | "stopPoint" | "wheelchairStatus"> & { className?: string }>) {
	// Le quai suit immédiatement le nom : le nom seul se tronque s'il manque de place.
	return (
		<span className="flex min-w-0 items-center gap-1">
			<span className={clsx("truncate font-bold leading-tight", className)} title={stopName}>
				{stopName ?? m.stop_departures_loading()}
			</span>
			{stopPoint?.platformCode !== undefined && (
				<span className="shrink-0 rounded-xs bg-foreground/80 dark:bg-foreground px-1 min-w-4 text-center text-xs font-bold text-background">
					{stopPoint.platformCode}
				</span>
			)}
			{wheelchairStatus !== undefined && (
				// Info-bulle portée hors du panneau : celui-ci rogne ce qui déborde de ses bords.
				<TapTooltip
					content={wheelchairIconDetails[wheelchairStatus].label()}
					render={
						<button
							aria-label={wheelchairIconDetails[wheelchairStatus].label()}
							// Rend à la pastille ses utilitaires face aux styles des boutons de MapLibre (`maplibregl.css`).
							data-slot="wheelchair-badge"
							className={clsx(
								"inline-flex size-5 shrink-0 cursor-default rounded-xs p-px",
								wheelchairIconDetails[wheelchairStatus].chipClasses,
							)}
							type="button"
						>
							<WheelchairIcon className="size-full" status={wheelchairStatus} tone="on-color" />
						</button>
					}
				/>
			)}
		</span>
	);
}

const directionTitle = (direction: StopCallDirection) =>
	direction === "arrivals" ? m.stop_arrivals_title() : m.stop_departures_title();

/** Bascule le tableau entre prochains départs et prochaines arrivées. */
function ReverseDirectionButton({
	direction,
	toggleDirection,
	touch = false,
}: Readonly<Pick<StopDeparturesState, "direction" | "toggleDirection"> & { touch?: boolean }>) {
	// Enveloppé : dans un contrôle MapLibre, un bouton qui en suit un autre reçoit une bordure haute.
	return (
		<span className="flex shrink-0">
			<Button
				aria-label={m.stop_departures_reverse()}
				aria-pressed={direction === "arrivals"}
				className={clsx(
					"aria-pressed:bg-branding/10 aria-pressed:text-branding dark:aria-pressed:bg-branding/40 dark:aria-pressed:text-branding-foreground",
					touch ? "size-9" : "size-7",
				)}
				size="icon"
				title={m.stop_departures_reverse()}
				type="button"
				variant="ghost"
				onClick={toggleDirection}
			>
				<ArrowRightLeftIcon className={clsx("m-auto", touch ? "size-5" : "size-4")} />
			</Button>
		</span>
	);
}

/**
 * Sur grand écran : panneau en surimpression de la carte — au même endroit et dans le même habillage
 * que le panneau des véhicules en ligne.
 */
function StopDeparturesControl(props: Readonly<StopDeparturesPanelProps>) {
	const map = useMap();
	const containerRef = useRef(document.createElement("div"));
	const { clearSelection } = useStopSelection();
	const [, setMarkerId] = useQueryState("marker-id");
	const {
		direction,
		reversible,
		toggleDirection,
		stopName,
		stopPoint,
		wheelchairStatus,
		rows,
		alerts,
		isError,
		isLoading,
	} = useStopDepartures(props);

	useEffect(() => {
		const container = containerRef.current;
		// La classe `stop-departures-control` permet de descendre le panneau par-dessus
		// l'attribution (cf. `maplibregl.css`).
		container.className = "maplibregl-ctrl maplibregl-ctrl-group font-sans stop-departures-control";

		const control = {
			onAdd: () => container,
			onRemove: () => container.remove(),
		};

		map.addControl(control, "bottom-right");
		const parent = container.parentElement;
		if (parent) {
			parent.style.zIndex = "10";
			// MapLibre empile les contrôles du bas en insérant chaque nouveau au-dessus des précédents :
			// le panneau est replacé juste au-dessus de l'attribution, qui garde le coin, et sous ceux
			// qui viendraient après lui.
			const attribution = parent.querySelector(":scope > .maplibregl-ctrl-attrib");
			parent.insertBefore(container, attribution);
		}
		return () => {
			map.removeControl(control);
		};
	}, [map]);

	return createPortal(
		<div className="w-96 max-w-[calc(100dvw-20px)] overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10">
			<div className="flex items-center gap-1 border-b py-1.5 pr-1.5 pl-3">
				<div className="mr-1 min-w-0 flex-1">
					<p className="text-[11px] font-semibold uppercase leading-tight tracking-wider text-muted-foreground">
						{directionTitle(direction)}
					</p>
					<StopName
						className="text-base"
						stopName={stopName}
						stopPoint={stopPoint}
						wheelchairStatus={wheelchairStatus}
					/>
				</div>
				<ServiceAlertsButton alerts={alerts} scope="stop" withLabel />
				{reversible && <ReverseDirectionButton direction={direction} toggleDirection={toggleDirection} />}
				<Button
					className="size-7 shrink-0"
					size="icon"
					title={m.stop_departures_close()}
					type="button"
					variant="ghost"
					onClick={clearSelection}
				>
					<XIcon className="size-4 m-auto" />
				</Button>
			</div>
			{/* Hauteur minimale : le panneau ne saute pas entre chargement, tableau vide et tableau rempli. */}
			<div className="flex min-h-[min(10rem,25dvh)] flex-col">
				<StopDeparturesList
					direction={direction}
					isError={isError}
					isLoading={isLoading}
					rows={rows}
					scrollClassName="max-h-[25dvh]"
					onLocate={(journeyId) => void setMarkerId(journeyId)}
				/>
			</div>
		</div>,
		containerRef.current,
	);
}

/**
 * Sur petit écran : drawer en bas de l'écran. Il n'est pas modal : la carte reste utilisable derrière
 * lui, et la toucher ne le ferme pas — on y localise un véhicule ou choisit un autre arrêt. Le fermer,
 * d'un geste ou de la croix, désélectionne l'arrêt, comme la croix du panneau — une fois l'animation
 * de sortie terminée seulement : désélectionner l'arrêt démonte le drawer, qui disparaîtrait sinon
 * d'un coup.
 */
function StopDeparturesDrawer(props: Readonly<StopDeparturesPanelProps>) {
	const map = useMap();
	const [open, setOpen] = useState(true);
	const { clearSelection } = useStopSelection();
	const [, setMarkerId] = useQueryState("marker-id");
	const {
		selectedRef,
		direction,
		reversible,
		toggleDirection,
		stopName,
		stopPoint,
		wheelchairStatus,
		location,
		rows,
		alerts,
		isError,
		isLoading,
	} = useStopDepartures(props);

	// Le drawer masque le bas de la carte, et peut-être l'arrêt qu'il décrit : la carte est recentrée
	// pour placer celui-ci au milieu de la partie restée visible. Une seule fois par sélection, pour ne
	// pas contrarier l'utilisateur qui déplace ensuite la carte, et une fois le tableau chargé, le
	// drawer ayant alors trouvé sa hauteur.
	const popupRef = useRef<HTMLDivElement | null>(null);
	const centeredRef = useRef<string | null>(null);
	useEffect(() => {
		const popup = popupRef.current;
		if (isLoading || location === undefined || popup === null || centeredRef.current === selectedRef) return;
		centeredRef.current = selectedRef;

		// Le drawer peut être encore en train de monter : sa position est déduite de sa hauteur, et non
		// de celle, provisoire, qu'il occupe à l'écran.
		const popupTop = window.innerHeight - popup.offsetHeight;
		const mapRect = map.getContainer().getBoundingClientRect();
		const hiddenHeight = Math.min(mapRect.height, Math.max(0, mapRect.bottom - popupTop));

		map.easeTo({
			center: [location.longitude, location.latitude],
			// La plaque, et non la pointe de sa hampe, au milieu de la partie visible.
			offset: [0, -hiddenHeight / 2 + STOP_PLATE_CENTER_OFFSET * SELECTED_STOP_ICON_SCALE],
		});
	}, [isLoading, location, map, selectedRef]);

	return (
		<Drawer
			disablePointerDismissal
			modal={false}
			open={open}
			onOpenChange={setOpen}
			onOpenChangeComplete={(open) => {
				if (!open) clearSelection();
			}}
		>
			<DrawerContent
				className="max-h-[45dvh]"
				// Le drawer masque le bas de la carte : localiser un véhicule le place au-dessus de lui.
				ref={(element) => {
					popupRef.current = element;
					const unregister = registerMapBottomOverlay(element);
					return () => {
						popupRef.current = null;
						unregister?.();
					};
				}}
				showOverlay={false}
			>
				<div className="flex items-start gap-2 border-b px-3 pt-1 pb-2">
					<div className="min-w-0 flex-1">
						<p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
							{directionTitle(direction)}
						</p>
						<DrawerTitle className="text-lg">
							<StopName stopName={stopName} stopPoint={stopPoint} wheelchairStatus={wheelchairStatus} />
						</DrawerTitle>
					</div>
					<ServiceAlertsButton alerts={alerts} className="mt-1.5" scope="stop" withLabel />
					{reversible && <ReverseDirectionButton direction={direction} toggleDirection={toggleDirection} touch />}
					<DrawerClose
						render={
							<Button className="size-9 shrink-0" size="icon" title={m.stop_departures_close()} variant="ghost">
								<XIcon className="size-5 m-auto" />
							</Button>
						}
					/>
				</div>
				{/*
				 * Hauteur minimale : le drawer ne saute pas entre chargement, tableau vide et tableau rempli.
				 * Le bas de la liste s'efface au lieu d'être coupé net au bord du drawer ; la marge du bas,
				 * aussi haute que le fondu, laisse la dernière ligne entière une fois la liste défilée.
				 */}
				<div className="flex min-h-[min(10rem,25dvh)] flex-1 flex-col">
					<StopDeparturesList
						direction={direction}
						isError={isError}
						isLoading={isLoading}
						rows={rows}
						scrollClassName="min-h-0 flex-1 pb-6 mask-b-from-[calc(100%-1.5rem)]"
						touch
						onLocate={(journeyId) => void setMarkerId(journeyId)}
					/>
				</div>
			</DrawerContent>
		</Drawer>
	);
}

type StopDeparturesPanelProps = {
	/** Réseau imposé par la carte embarquée : seules ses lignes figurent au tableau. */
	networkId?: number;
	/** Lignes filtrées sur la carte : elles seules figurent au tableau. */
	lineIds?: number[];
};

/** Prochains passages de l'arrêt sélectionné : panneau sur grand écran, drawer sur petit. */
export function StopDeparturesPanel(props: Readonly<StopDeparturesPanelProps>) {
	const isDesktop = useMediaQuery("(min-width: 640px)");
	if (isDesktop) return <StopDeparturesControl {...props} />;
	// Non modal, le drawer pose des gardes de focus à l'endroit où il est rendu, et non dans son portail :
	// dans le conteneur de la carte, dont MapLibre réordonne les enfants, React ne s'y retrouverait plus.
	return createPortal(<StopDeparturesDrawer {...props} />, document.body);
}

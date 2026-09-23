import { useQueries, useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import dayjs from "dayjs";
import { LocateIcon, Rss, XIcon } from "lucide-react";
import { useQueryState } from "nuqs";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMediaQuery } from "usehooks-ts";

import { useMap } from "~/adapters/maplibre-gl/map";
import { GetNetworkQuery, type Line } from "~/api/networks";
import { GetStopDeparturesQuery, type StopDeparture } from "~/api/stops";
import { Button } from "~/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from "~/components/ui/drawer";
import { formatCountdown, formatLocalTime } from "~/components/vehicles-map/call-time-format";
import { registerMapBottomOverlay } from "~/components/vehicles-map/map-bottom-overlay";
import { type NextCallsDisplayMode, useNextCallsDisplayMode } from "~/components/vehicles-map/next-calls-display-mode";
import { SELECTED_STOP_ICON_SCALE, STOP_PLATE_CENTER_OFFSET } from "~/components/vehicles-map/stops-markers/stop-icon";
import { useStopSelection } from "~/components/vehicles-map/stops-markers/stop-selection";
import { useDebouncedMemo } from "~/hooks/use-debounced-memo";
import * as m from "~/paraglide/messages";

/** En heure absolue, un départ de terminus n'est annoncé comme tel qu'à l'approche de son heure. */
const DEPARTURE_ANNOUNCE_MINUTES = 10;

function formatDepartureLabel(departure: StopDeparture, displayMode: NextCallsDisplayMode, now: dayjs.Dayjs) {
	const time = departure.expectedTime ?? departure.aimedTime;
	const minutes = dayjs(time).diff(now, "minutes");

	// Au terminus de départ, le véhicule attend souvent déjà son heure : le passage est annoncé comme
	// un départ.
	const departing = departure.origin === true && departure.callStatus !== "SKIPPED";

	// En heure absolue, l'heure est toujours affichée telle quelle, même dépassée ou supprimée.
	if (displayMode === "absolute") {
		return departing && minutes < DEPARTURE_ANNOUNCE_MINUTES
			? m.stop_departures_departure_at({ time: formatLocalTime(time) })
			: formatLocalTime(time);
	}

	if (departing) {
		if (minutes < 1) return m.stop_departures_departure_imminent();
		return m.stop_departures_departure_in({ time: formatCountdown(minutes) });
	}

	if (departure.callStatus === "SKIPPED") return m.stop_call_cancelled();

	// Moins d'une minute, ou heure dépassée alors que le véhicule n'est pas encore passé (source jugeant
	// le passage sur sa progression) : il arrive.
	if (minutes < 1) return m.stop_departures_approaching();
	return formatCountdown(minutes);
}

/**
 * Pictogramme de la ligne lorsque le réseau en fournit un, pastille à ses couleurs sinon — comme
 * dans le module de filtre de la carte. Il ouvre la ligne du tableau, large comme son contenu.
 */
function LinePictogram({ line }: Readonly<{ line?: Line }>) {
	if (line?.cartridgeHref) {
		return (
			<img alt={line.number} className="h-6 max-w-20 object-contain object-left shrink-0" src={line.cartridgeHref} />
		);
	}

	// Le numéro de girouette est la forme courte du numéro, faite pour l'affichage. Un bloc et non un
	// conteneur flex : l'ellipse ne s'applique pas au texte d'un conteneur flex, qui serait coupé net
	// au lieu d'être tronqué proprement.
	return (
		<span
			className="block shrink-0 min-w-7 max-w-20 truncate rounded-sm px-1 text-center text-base font-bold leading-6"
			style={{
				backgroundColor: line?.color ?? "#18181B",
				color: line?.textColor ?? "#FFFFFF",
			}}
			title={line?.number}
		>
			{line?.girouetteNumber ?? line?.number ?? "?"}
		</span>
	);
}

type DepartureRowProps = {
	departure: StopDeparture;
	line?: Line;
	label: string;
	/** Ligne plus haute et bouton plus large, pour le doigt plutôt que le pointeur. */
	touch?: boolean;
	onLocate: (journeyId: string) => void;
};

/** Seul un véhicule effectivement suivi peut être rejoint sur la carte. */
const isLocatable = (departure: StopDeparture) => departure.tracked && departure.journeyId !== undefined;

function DepartureRow({ departure, line, label, touch = false, onLocate }: Readonly<DepartureRowProps>) {
	const skipped = departure.callStatus === "SKIPPED";
	const extra = departure.callStatus === "UNSCHEDULED";
	const realtime = departure.expectedTime !== undefined;

	// L'heure théorique n'est rappelée que lorsqu'elle diffère de celle affichée : un passage à l'heure
	// n'a rien à corriger.
	const showAimedTime =
		!skipped &&
		departure.expectedTime !== undefined &&
		formatLocalTime(departure.expectedTime) !== formatLocalTime(departure.aimedTime);

	// Rouge : le passage est supprimé. Orange : desserte ajoutée par une déviation, comme dans la
	// pop-up du véhicule — l'icône dit seule si son heure vient du temps réel. Vert : l'heure vient du
	// temps réel. Noir : elle n'est que théorique.
	const accentColor = skipped
		? "text-red-700 dark:text-red-500"
		: extra
			? "text-yellow-700 dark:text-yellow-500"
			: realtime
				? "text-green-700 dark:text-green-500"
				: "text-foreground";

	// Pictogramme, destination et quai se suivent ; l'heure est rejetée à l'autre bout de la ligne. La
	// case de localisation, qui la suit, est tenue même sur un passage qui n'est pas joignable : les
	// heures s'alignent ainsi d'une ligne à l'autre. La hauteur est fixe : une ligne ne grandit pas
	// quand l'heure théorique s'affiche sous l'heure prévue.
	return (
		<li className={clsx("flex items-center gap-1", touch ? "h-10" : "h-9")}>
			<LinePictogram line={line} />
			{/*
			 * Le quai suit immédiatement la destination. Une destination longue passe sur deux lignes avant
			 * d'être tronquée — « Hôpital Européen Georges Pompidou » se lit en entier — ce que la hauteur
			 * fixe de la ligne permet sans rien décaler. Le quai est placé dans le fil du texte, et non à côté
			 * de lui : une boîte passée sur deux lignes prend toute la largeur disponible, et le quai se
			 * retrouverait rejeté au bord droit au lieu de suivre le dernier mot.
			 */}
			<div className="min-w-0 flex-1">
				<p className="line-clamp-2 break-words text-sm leading-tight" title={departure.destination}>
					{departure.destination ?? departure.stopName}
					{departure.platformName !== undefined && (
						<span
							className="ml-1 inline-block rounded-xs bg-foreground/80 dark:bg-foreground px-1 min-w-4.5 text-center align-[1px] text-[13px] font-bold leading-4 text-background"
							title={departure.stopName}
						>
							{departure.platformName}
						</span>
					)}
				</p>
			</div>
			<div className="flex shrink-0 flex-col items-end leading-tight">
				<span className={clsx("flex items-start text-sm font-bold tabular-nums whitespace-nowrap", accentColor)}>
					{realtime && !skipped ? (
						<Rss aria-label={m.stop_call_realtime()} className="-rotate-90 mr-[0.5px]" size={8} />
					) : null}
					<span className={clsx(skipped && "line-through")}>{label}</span>
				</span>
				{showAimedTime && (
					<span className="text-[10px] text-muted-foreground line-through tabular-nums">
						{formatLocalTime(departure.aimedTime)}
					</span>
				)}
			</div>
			<div className={clsx("shrink-0", touch ? "size-8" : "size-6")}>
				{isLocatable(departure) && (
					<Button
						className={touch ? "size-8" : "size-6"}
						size="icon"
						title={m.stop_departures_locate()}
						type="button"
						variant="ghost"
						onClick={() => onLocate(departure.journeyId!)}
					>
						<LocateIcon className={clsx("m-auto", touch ? "size-5" : "size-4")} />
					</Button>
				)}
			</div>
		</li>
	);
}

/**
 * Prochains passages de l'arrêt sélectionné, lignes du réseau comprises, prêts à afficher — communs
 * au panneau et au drawer.
 */
function useStopDepartures() {
	const { selectedRef } = useStopSelection();
	const [displayMode] = useNextCallsDisplayMode();

	const { data, isError, isPending } = useQuery(GetStopDeparturesQuery(selectedRef));
	// Les lignes des réseaux de la station, pour leur numéro, leurs couleurs et leur pictogramme : une
	// requête au plus toutes les 5 min par réseau, souvent déjà en cache — le module de filtre fait la
	// même. Une gare peut en réunir plusieurs (TER, Intercités, TGV…), et une ligne peut relever d'un
	// réseau que la station ne déclare pas : ceux des passages s'y ajoutent.
	const networkIds = [
		...new Set([
			...(data?.stop.networkIds ?? []),
			...(data?.departures.flatMap(({ lineNetworkId }) => (lineNetworkId !== undefined ? [lineNetworkId] : [])) ?? []),
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

		return [{ departure, line, label: labels[index] ?? "", key: `${baseKey}-${occurrence}` }];
	});

	return {
		selectedRef,
		stopName: data?.stop.name,
		stopPoint,
		// Point à montrer sur la carte : le quai choisi, la station sinon.
		location: data === undefined ? undefined : (stopPoint ?? data.stop),
		rows,
		isError,
		isLoading: isPending || areLinesPending,
	};
}

type StopDeparturesState = ReturnType<typeof useStopDepartures>;

/** Nom de l'arrêt, suivi du quai s'il y en a un de choisi. */
function StopName({
	stopName,
	stopPoint,
	className,
}: Readonly<Pick<StopDeparturesState, "stopName" | "stopPoint"> & { className?: string }>) {
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
		</span>
	);
}

type StopDeparturesListProps = Pick<StopDeparturesState, "rows" | "isError" | "isLoading"> & {
	touch?: boolean;
	/** Classes de la zone défilante. */
	scrollClassName: string;
	onLocate: (journeyId: string) => void;
};

function StopDeparturesList({
	rows,
	isError,
	isLoading,
	touch,
	scrollClassName,
	onLocate,
}: Readonly<StopDeparturesListProps>) {
	const message = isError
		? m.stop_departures_error()
		: isLoading
			? m.stop_departures_loading()
			: rows.length === 0
				? m.stop_departures_empty()
				: undefined;

	if (message !== undefined) {
		return <p className="m-auto px-2 py-3 text-center text-sm text-muted-foreground">{message}</p>;
	}

	// La zone défilante ne porte pas la marge intérieure : posée sur la liste qu'elle contient, elle
	// reste entre le contenu et la barre de défilement, contre laquelle l'heure viendrait sinon se coller.
	return (
		<div className={clsx("overflow-y-auto overscroll-contain", scrollClassName)}>
			<ul className={clsx("divide-y", touch ? "px-3" : "px-2")}>
				{rows.map(({ departure, line, label, key }) => (
					<DepartureRow departure={departure} key={key} line={line} label={label} touch={touch} onLocate={onLocate} />
				))}
			</ul>
		</div>
	);
}

/**
 * Sur grand écran : panneau en surimpression de la carte — au même endroit et dans le même habillage
 * que le panneau des véhicules en ligne.
 */
function StopDeparturesControl() {
	const map = useMap();
	const containerRef = useRef(document.createElement("div"));
	const { clearSelection } = useStopSelection();
	const [, setMarkerId] = useQueryState("marker-id");
	const { stopName, stopPoint, rows, isError, isLoading } = useStopDepartures();

	useEffect(() => {
		const container = containerRef.current;
		// La classe `stop-departures-control` permet de descendre le panneau par-dessus
		// l'attribution (cf. `maplibregl.css`).
		container.className = "maplibregl-ctrl maplibregl-ctrl-group font-sans stop-departures-control";

		const control = {
			onAdd: () => container,
			onRemove: () => void 0,
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
		<div className="bg-background/95 backdrop-blur-sm rounded-sm shadow-lg border overflow-hidden w-96 max-w-[calc(100dvw-20px)]">
			<div className="flex items-center gap-1 border-b px-1 py-0.5">
				<div className="flex-1 min-w-0">
					<p className="text-[10px] font-thin uppercase tracking-wide leading-tight">{m.stop_departures_title()}</p>
					<StopName className="text-base" stopName={stopName} stopPoint={stopPoint} />
				</div>
				<Button
					className="size-6 shrink-0"
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
function StopDeparturesDrawer() {
	const map = useMap();
	const [open, setOpen] = useState(true);
	const { clearSelection } = useStopSelection();
	const [, setMarkerId] = useQueryState("marker-id");
	const { selectedRef, stopName, stopPoint, location, rows, isError, isLoading } = useStopDepartures();

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
						<p className="text-xs uppercase tracking-wide text-muted-foreground">{m.stop_departures_title()}</p>
						<DrawerTitle className="text-lg">
							<StopName stopName={stopName} stopPoint={stopPoint} />
						</DrawerTitle>
					</div>
					<DrawerClose
						render={
							<Button className="size-9 shrink-0" size="icon" title={m.stop_departures_close()} variant="ghost">
								<XIcon className="size-5 m-auto" />
							</Button>
						}
					/>
				</div>
				{/* Hauteur minimale : le drawer ne saute pas entre chargement, tableau vide et tableau rempli. */}
				<div className="flex min-h-[min(10rem,25dvh)] flex-1 flex-col">
					<StopDeparturesList
						isError={isError}
						isLoading={isLoading}
						rows={rows}
						scrollClassName="min-h-0 flex-1 pb-2"
						touch
						onLocate={(journeyId) => void setMarkerId(journeyId)}
					/>
				</div>
			</DrawerContent>
		</Drawer>
	);
}

/** Prochains passages de l'arrêt sélectionné : panneau sur grand écran, drawer sur petit. */
export function StopDeparturesPanel() {
	const isDesktop = useMediaQuery("(min-width: 640px)");
	if (isDesktop) return <StopDeparturesControl />;
	// Non modal, le drawer pose des gardes de focus à l'endroit où il est rendu, et non dans son portail :
	// dans le conteneur de la carte, dont MapLibre réordonne les enfants, React ne s'y retrouverait plus.
	return createPortal(<StopDeparturesDrawer />, document.body);
}

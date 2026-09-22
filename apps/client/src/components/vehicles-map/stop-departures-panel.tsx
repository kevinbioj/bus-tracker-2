import { useQueries, useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import dayjs from "dayjs";
import { LocateIcon, Rss, XIcon } from "lucide-react";
import { useQueryState } from "nuqs";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { useMap } from "~/adapters/maplibre-gl/map";
import { GetNetworkQuery, type Line } from "~/api/networks";
import { GetStopDeparturesQuery, type StopDeparture } from "~/api/stops";
import { Button } from "~/components/ui/button";
import { formatCountdown, formatLocalTime } from "~/components/vehicles-map/call-time-format";
import { type NextCallsDisplayMode, useNextCallsDisplayMode } from "~/components/vehicles-map/next-calls-display-mode";
import { SELECTED_STOP_ICON_SCALE, STOP_PLATE_CENTER_OFFSET } from "~/components/vehicles-map/stops-markers/stop-icon";
import { useStopSelection } from "~/components/vehicles-map/stops-markers/stop-selection";
import { useDebouncedMemo } from "~/hooks/use-debounced-memo";
import * as m from "~/paraglide/messages";

function formatDepartureLabel(departure: StopDeparture, displayMode: NextCallsDisplayMode, now: dayjs.Dayjs) {
	const time = departure.expectedTime ?? departure.aimedTime;

	// Au terminus de départ, le véhicule attend souvent déjà son heure : le passage est annoncé comme
	// un départ. Partout ailleurs, l'heure seule suffit.
	if (departure.origin === true && departure.callStatus !== "SKIPPED") {
		const minutes = dayjs(time).diff(now, "minutes");
		if (minutes < 1) return m.stop_departures_departure_imminent();
		return displayMode === "absolute"
			? m.stop_departures_departure_at({ time: formatLocalTime(time) })
			: m.stop_departures_departure_in({ time: formatCountdown(minutes) });
	}

	// Heure dépassée mais véhicule pas encore passé (source jugeant le passage sur la progression du
	// véhicule) : il arrive, afficher une heure déjà écoulée ne dirait rien d'utile.
	if (departure.callStatus !== "SKIPPED" && dayjs(time).isBefore(now)) return m.stop_call_imminent();

	if (displayMode === "absolute") return formatLocalTime(time);
	if (departure.callStatus === "SKIPPED") return m.stop_call_cancelled();

	const minutes = dayjs(time).diff(now, "minutes");
	if (minutes < 1) return m.stop_call_imminent();
	return formatCountdown(minutes);
}

/**
 * Pictogramme de la ligne lorsque le réseau en fournit un, pastille à ses couleurs sinon — comme
 * dans le module de filtre de la carte. Il occupe la première colonne du tableau, large comme le plus
 * large d'entre eux : un pictogramme fourni y est calé à gauche, une pastille centrée.
 */
function LinePictogram({ line }: Readonly<{ line?: Line }>) {
	if (line?.cartridgeHref) {
		return (
			<img
				alt={line.number}
				className="h-6 max-w-20 justify-self-start object-contain object-left shrink-0"
				src={line.cartridgeHref}
			/>
		);
	}

	// Le numéro de girouette est la forme courte du numéro, faite pour l'affichage. Un bloc et non un
	// conteneur flex : l'ellipse ne s'applique pas au texte d'un conteneur flex, qui serait coupé net
	// au lieu d'être tronqué proprement. Large comme son texte (`w-fit`) : sans quoi, élément de grille,
	// il s'étirerait sur toute la colonne.
	return (
		<span
			className="block w-full shrink-0 min-w-7 max-w-20 justify-self-center truncate rounded-sm px-1 text-center text-base font-bold leading-6"
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
	onLocate: (journeyId: string) => void;
};

/** Marge que MapLibre ménage autour de ses contrôles, de part et d'autre du panneau. */
const PANEL_MARGIN_PX = 10;

/** Seul un véhicule effectivement suivi peut être rejoint sur la carte. */
const isLocatable = (departure: StopDeparture) => departure.tracked && departure.journeyId !== undefined;

function DepartureRow({ departure, line, label, onLocate }: Readonly<DepartureRowProps>) {
	const skipped = departure.callStatus === "SKIPPED";
	const realtime = departure.expectedTime !== undefined;

	// L'heure théorique n'est rappelée que lorsqu'elle diffère de celle affichée : un passage à l'heure
	// n'a rien à corriger.
	const showAimedTime =
		!skipped &&
		departure.expectedTime !== undefined &&
		formatLocalTime(departure.expectedTime) !== formatLocalTime(departure.aimedTime);

	// Vert : l'heure vient du temps réel. Noir : elle n'est que théorique. Rouge : le passage est supprimé.
	const accentColor = skipped
		? "text-red-700 dark:text-red-500"
		: realtime
			? "text-green-700 dark:text-green-500"
			: "text-foreground";

	// Chaque ligne reprend les colonnes du tableau (`subgrid`) : pictogramme, destination et quai, heure
	// et localisation s'alignent d'une ligne à l'autre quel que soit leur contenu. Les quatre cellules
	// sont donc toujours rendues, vides au besoin, pour ne pas glisser d'une colonne. La hauteur est
	// fixe : une ligne ne grandit pas quand l'heure théorique s'affiche sous l'heure prévue.
	return (
		<li className="col-span-full grid h-9 grid-cols-subgrid items-center px-1">
			<LinePictogram line={line} />
			{/*
			 * Le quai suit immédiatement la destination. Une destination longue passe sur deux lignes avant
			 * d'être tronquée — « Hôpital Européen Georges Pompidou » se lit en entier — ce que la hauteur
			 * fixe de la ligne permet sans rien décaler.
			 */}
			<div className="flex min-w-0 items-center gap-1">
				{/* Enveloppe : la troncature sur deux lignes est capricieuse posée sur un élément flex lui-même. */}
				<div className="min-w-0">
					<p className="line-clamp-2 break-words text-sm leading-tight" title={departure.destination}>
						{departure.destination ?? departure.stopName}
					</p>
				</div>
				{departure.platformName !== undefined && (
					<span
						className="shrink-0 rounded-xs bg-foreground/80 dark:bg-foreground px-1 min-w-4 text-center text-xs font-bold text-background"
						title={departure.stopName}
					>
						{departure.platformName}
					</span>
				)}
			</div>
			<div className="flex flex-col items-end leading-tight">
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
			<div>
				{isLocatable(departure) && (
					<Button
						className="size-6"
						size="icon"
						title={m.stop_departures_locate()}
						type="button"
						variant="ghost"
						onClick={() => onLocate(departure.journeyId!)}
					>
						<LocateIcon className="size-4 m-auto" />
					</Button>
				)}
			</div>
		</li>
	);
}

/**
 * Prochains passages de l'arrêt sélectionné, en surimpression de la carte — au même endroit et dans
 * le même habillage que le panneau des véhicules en ligne.
 */
export function StopDeparturesPanel() {
	const map = useMap();
	const containerRef = useRef(document.createElement("div"));
	const { selectedRef, clearSelection } = useStopSelection();
	const [, setMarkerId] = useQueryState("marker-id");
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

	// Sur un écran étroit, le panneau occupe toute la largeur du bas de la carte et peut masquer l'arrêt
	// qu'il décrit : la carte est alors recentrée pour placer celui-ci au milieu de la partie restée
	// visible, au-dessus du panneau. Une seule fois par sélection, pour ne pas contrarier l'utilisateur
	// qui déplace ensuite la carte.
	const centeredRef = useRef<string | null>(null);
	useEffect(() => {
		if (data === undefined || selectedRef === null || centeredRef.current === selectedRef) return;
		centeredRef.current = selectedRef;

		const panelRect = containerRef.current.getBoundingClientRect();
		const mapRect = map.getContainer().getBoundingClientRect();
		// Le panneau est plafonné à la largeur de la carte moins ses marges : l'atteindre, c'est la couvrir.
		if (panelRect.width + 2 * PANEL_MARGIN_PX < mapRect.width - 1) return;

		const point = data.stop.stopPoints.find(({ ref }) => ref === data.stopPointRef) ?? data.stop;
		// Hauteur de carte masquée par le panneau, depuis son bord supérieur jusqu'au bas de la carte.
		const hiddenHeight = Math.max(0, mapRect.bottom - panelRect.top);

		map.easeTo({
			center: [point.longitude, point.latitude],
			// La plaque, et non la pointe de sa hampe, au milieu de la partie visible.
			offset: [0, -hiddenHeight / 2 + STOP_PLATE_CENTER_OFFSET * SELECTED_STOP_ICON_SCALE],
		});
	}, [data, map, selectedRef]);

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

	return createPortal(
		<div className="bg-background/95 backdrop-blur-sm rounded-sm shadow-lg border overflow-hidden w-96 max-w-[calc(100dvw-20px)]">
			<div className="flex items-center gap-1 border-b px-1 py-0.5">
				<div className="flex-1 min-w-0">
					<p className="text-[10px] font-thin uppercase tracking-wide leading-tight">{m.stop_departures_title()}</p>
					{/* Le quai suit immédiatement le nom : le nom seul se tronque s'il manque de place. */}
					<div className="flex min-w-0 items-center gap-1">
						<p className="truncate text-base font-bold leading-tight" title={data?.stop.name}>
							{data?.stop.name ?? m.stop_departures_loading()}
						</p>
						{stopPoint?.platformCode !== undefined && (
							<span className="shrink-0 rounded-xs bg-foreground/80 dark:bg-foreground px-1 min-w-4 text-center text-xs font-bold text-background">
								{stopPoint.platformCode}
							</span>
						)}
					</div>
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
				{isError ? (
					<p className="m-auto px-2 py-3 text-center text-sm text-muted-foreground">{m.stop_departures_error()}</p>
				) : isPending || areLinesPending ? (
					<p className="m-auto px-2 py-3 text-center text-sm text-muted-foreground">{m.stop_departures_loading()}</p>
				) : rows.length === 0 ? (
					<p className="m-auto px-2 py-3 text-center text-sm text-muted-foreground">{m.stop_departures_empty()}</p>
				) : (
					<ul className="grid max-h-[25dvh] grid-cols-[auto_minmax(0,1fr)_auto_auto] gap-x-1 divide-y overflow-y-auto overscroll-contain">
						{rows.map(({ departure, line, label, key }) => (
							<DepartureRow
								departure={departure}
								key={key}
								line={line}
								label={label}
								onLocate={(journeyId) => void setMarkerId(journeyId)}
							/>
						))}
					</ul>
				)}
			</div>
		</div>,
		containerRef.current,
	);
}

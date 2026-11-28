import type { StopCallDirection } from "@bus-tracker/contracts";
import { clsx } from "clsx";
import dayjs from "dayjs";
import { InfoIcon, LocateIcon, Rss, XIcon } from "lucide-react";

import type { Line } from "~/api/networks";
import type { StopDeparture } from "~/api/stops";
import { TapTooltip } from "~/components/tap-tooltip";
import { formatCountdown, formatLocalTime } from "~/components/vehicles-map/call-time-format";
import type { NextCallsDisplayMode } from "~/components/vehicles-map/next-calls-display-mode";
import { useFitToLines } from "~/hooks/use-fit-to-lines";
import { OnDemandIcon, onDemandLabels } from "~/icons/on-demand";
import { TriangleAlertFilledIcon } from "~/icons/triangle-alert-filled";
import { WheelchairIcon, type WheelchairStatus, wheelchairIconDetails } from "~/icons/wheelchair";
import * as m from "~/paraglide/messages";
import { DEFAULT_LINE_COLOR, DEFAULT_LINE_TEXT_COLOR } from "~/utils/line-colors";

export function formatDepartureLabel(departure: StopDeparture, displayMode: NextCallsDisplayMode, now: dayjs.Dayjs) {
	const time = departure.expectedTime ?? departure.aimedTime;

	// En heure absolue, l'heure est toujours affichée telle quelle, même dépassée ou supprimée.
	if (displayMode === "absolute") return formatLocalTime(time);

	// Moins d'une minute, ou heure dépassée alors que le véhicule n'est pas encore passé (source jugeant
	// le passage sur sa progression).
	const minutes = dayjs(time).diff(now, "minutes");
	return minutes < 1 ? m.stop_call_under_a_minute() : formatCountdown(minutes);
}

/**
 * Pictogramme de la ligne lorsque le réseau en fournit un, pastille à ses couleurs sinon — comme
 * dans le module de filtre de la carte. Il ouvre la ligne du tableau, large comme son contenu.
 */
export function LinePictogram({ line }: Readonly<{ line?: Line }>) {
	if (line?.cartridgeHref) {
		return (
			<img alt={line.number} className="h-7 max-w-22 object-contain object-left shrink-0" src={line.cartridgeHref} />
		);
	}

	// Le numéro de girouette est la forme courte du numéro, faite pour l'affichage. Un bloc et non un
	// conteneur flex : l'ellipse ne s'applique pas au texte d'un conteneur flex, qui serait coupé net
	// au lieu d'être tronqué proprement.
	return (
		<span
			className="block shrink-0 min-w-8 max-w-22 truncate rounded-md px-1.5 text-center text-base font-bold leading-7"
			style={{
				backgroundColor: line?.color ?? DEFAULT_LINE_COLOR,
				color: line?.textColor ?? DEFAULT_LINE_TEXT_COLOR,
			}}
			title={line?.number}
		>
			{line?.girouetteNumber ?? line?.number ?? "?"}
		</span>
	);
}

type DepartureRowProps = {
	departure: StopDeparture;
	direction: StopCallDirection;
	line?: Line;
	label: string;
	/** Accessibilité du véhicule, montrée seulement lorsque l'arrêt n'est pas connu comme inaccessible. */
	wheelchairStatus?: WheelchairStatus;
	/**
	 * Le passage a lieu à un arrêt provisoire, alors que le tableau est celui de la station : pour la
	 * station, l'arrêt est déplacé, et le voyageur doit être averti que la course ne s'arrête pas à son
	 * quai habituel.
	 */
	relocated?: boolean;
	/** Ligne plus haute, pour le doigt plutôt que le pointeur. */
	touch?: boolean;
	stopLabel?: string;
	onLocate?: (journeyId: string) => void;
};

/** Encadré du code mission et du numéro de train, comme dans la pop-up du véhicule. */
const journeyChipClasses =
	"rounded-sm bg-neutral-200 px-1 font-semibold text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100";

/** Seul un véhicule effectivement suivi peut être rejoint sur la carte. */
const isLocatable = (departure: StopDeparture) => departure.tracked && departure.journeyId !== undefined;

export function DepartureRow({
	departure,
	direction,
	line,
	label,
	wheelchairStatus,
	relocated = false,
	touch = false,
	stopLabel,
	onLocate,
}: Readonly<DepartureRowProps>) {
	const skipped = departure.callStatus === "SKIPPED";
	const extra = departure.callStatus === "UNSCHEDULED";
	// La course qui assure le passage est jugée non honorée : affichée, mais signalée comme peut-être
	// supprimée, ce qui prime sur toute autre mention.
	const potentiallyCanceled = !skipped && departure.potentiallyCanceled === true;
	const temporary = !skipped && !potentiallyCanceled && departure.temporary === true;
	// Un passage supprimé n'a pas d'heure attendue : c'est alors la course qui dit si elle est suivie en
	// temps réel.
	const realtime = departure.expectedTime !== undefined || (skipped && departure.realtime === true);

	// L'heure théorique n'est rappelée que lorsqu'elle diffère de celle affichée : un passage à l'heure
	// n'a rien à corriger. Sous un arrêt provisoire ou une course peut-être supprimée, elle cède la place
	// à la mention : la hauteur de la ligne ne tient pas les deux.
	const showAimedTime =
		!skipped &&
		!potentiallyCanceled &&
		!temporary &&
		departure.expectedTime !== undefined &&
		formatLocalTime(departure.expectedTime) !== formatLocalTime(departure.aimedTime);

	// Rouge : le passage est supprimé. Orange : la course l'est peut-être. Jaune : desserte ajoutée par
	// une déviation, comme dans la pop-up du véhicule — l'icône dit seule si son heure vient du temps
	// réel. Vert : l'heure vient du temps réel. Noir : elle n'est que théorique.
	// À l'arrivée, la provenance de la course plutôt que sa destination.
	const headline =
		(direction === "arrivals" ? departure.originName : undefined) ?? departure.destination ?? departure.stopName;
	const headlineRef = useFitToLines<HTMLParagraphElement>(headline);

	const accentColor = skipped
		? "text-red-700 dark:text-red-500"
		: potentiallyCanceled
			? "text-orange-700 dark:text-orange-500"
			: extra
				? "text-yellow-700 dark:text-yellow-500"
				: realtime
					? "text-green-700 dark:text-green-500"
					: "text-foreground";

	// Pictogramme puis destination ; le quai, collé à l'heure, est rejeté avec elle à l'autre bout de la
	// ligne. La hauteur est fixe : une ligne ne grandit pas quand l'heure théorique s'affiche sous l'heure
	// prévue.
	const locatable = onLocate !== undefined && isLocatable(departure);
	return (
		<li className="group relative">
			{locatable && (
				<button
					aria-label={`${m.stop_departures_locate()} : ${line?.number ?? ""} ${headline}`}
					className="absolute inset-0 rounded-md transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-branding/50"
					data-slot="map-panel-row"
					title={m.stop_departures_locate()}
					type="button"
					onClick={() => onLocate?.(departure.journeyId!)}
				/>
			)}
			<div
				className={clsx(
					"relative flex items-center gap-1 px-1",
					locatable && "pointer-events-none",
					stopLabel !== undefined && departure.missionCode !== undefined
						? touch
							? "h-13"
							: "h-12.5"
						: touch
							? "h-11"
							: "h-10",
				)}
			>
				<LinePictogram line={line} />
				{/*
				 * Le code mission surmonte la destination. Celle-ci, seule, passe sur deux lignes avant d'être
				 * tronquée — « Hôpital Européen Georges Pompidou » se lit en entier — ce que la hauteur fixe de
				 * la ligne permet sans rien décaler ; sous un code mission, elle n'a plus la place que d'une.
				 * C'est elle qui rétrécit : le pictogramme d'accessibilité et le numéro de train qui la suivent
				 * restent entiers.
				 */}
				<div className="flex min-w-0 flex-1 flex-col justify-center">
					{departure.missionCode !== undefined && (
						// En petit : il partage la hauteur fixe de la ligne avec la destination.
						<span
							className={clsx(
								"mb-0.5 max-w-full self-start truncate pt-px font-mono text-[10px] leading-3.5",
								journeyChipClasses,
							)}
						>
							{departure.missionCode}
						</span>
					)}
					<div className="flex min-w-0 items-center gap-1">
						<p
							className={clsx(
								"min-w-0 break-words text-sm leading-tight",
								departure.missionCode !== undefined || stopLabel !== undefined ? "line-clamp-1" : "line-clamp-2",
							)}
							title={headline}
							ref={headlineRef}
						>
							{headline}
						</p>
						{departure.onDemand !== undefined && (
							<TapTooltip
								content={onDemandLabels[departure.onDemand]()}
								render={
									<button
										aria-label={onDemandLabels[departure.onDemand]()}
										data-slot="on-demand-badge"
										className="pointer-events-auto inline-flex size-4 shrink-0 cursor-default text-muted-foreground"
										type="button"
									>
										<OnDemandIcon className="size-full" kind={departure.onDemand} />
									</button>
								}
							/>
						)}
						{wheelchairStatus !== undefined && (
							// Info-bulle portée hors du panneau : celui-ci rogne ce qui déborde de ses bords.
							<TapTooltip
								content={wheelchairIconDetails[wheelchairStatus].label()}
								render={
									<button
										aria-label={wheelchairIconDetails[wheelchairStatus].label()}
										// Rend au bouton ses utilitaires face aux styles des boutons de MapLibre (`maplibregl.css`).
										data-slot="wheelchair-badge"
										className="pointer-events-auto inline-flex size-4 shrink-0 cursor-default"
										type="button"
									>
										<WheelchairIcon className="size-full" status={wheelchairStatus} />
									</button>
								}
							/>
						)}
						{departure.journeyNumber !== undefined && (
							<span className={clsx("shrink-0 text-xs leading-4.5 tabular-nums", journeyChipClasses)}>
								{departure.journeyNumber}
							</span>
						)}
					</div>
					{stopLabel !== undefined && (
						<p className="truncate text-xs leading-tight text-muted-foreground" title={stopLabel}>
							{stopLabel}
						</p>
					)}
				</div>
				<div className="flex shrink-0 items-center gap-1 ml-2">
					{departure.platformName !== undefined && (
						<span
							className="rounded-xs bg-foreground/80 dark:bg-foreground px-1 min-w-4.5 text-center text-[13px] font-bold leading-4 text-background"
							title={departure.stopName}
						>
							{departure.platformName}
						</span>
					)}
					<div className="flex flex-col items-end leading-tight">
						<span className={clsx("flex items-start text-sm font-bold tabular-nums whitespace-nowrap", accentColor)}>
							{realtime ? <Rss aria-label={m.stop_call_realtime()} className="-rotate-90 mr-[0.5px]" size={8} /> : null}
							<span className={clsx(skipped && "line-through")}>{label}</span>
						</span>
						{showAimedTime && (
							<span className="text-[10px] text-muted-foreground line-through tabular-nums">
								{formatLocalTime(departure.aimedTime)}
							</span>
						)}
						{/* Sous l'heure barrée, ce qui est supprimé : la course entière, ou le seul arrêt. */}
						{skipped && (
							<span className="flex items-center gap-0.5 text-xs font-semibold text-red-700 dark:text-red-500 whitespace-nowrap">
								<XIcon className="shrink-0" size={12} strokeWidth={3} />
								{departure.canceled ? m.stop_departures_trip_cancelled() : m.stop_call_skipped()}
							</span>
						)}
						{/* La course n'est pas annoncée supprimée, mais plus aucun véhicule ne l'assure : elle l'est peut-être. */}
						{potentiallyCanceled && (
							<span className="flex items-center gap-0.5 text-xs font-semibold text-orange-700 dark:text-orange-500 whitespace-nowrap">
								<TriangleAlertFilledIcon className="shrink-0" size={12} />
								{m.stop_departures_trip_potentially_cancelled()}
							</span>
						)}
						{/*
						 * Sous l'heure, l'arrêt provisoire qui remplace pour cette course un quai de la station : au
						 * tableau de la station, c'est l'arrêt qui est déplacé ; à celui du quai, c'est un arrêt provisoire.
						 */}
						{temporary && (
							<span className="flex items-center gap-0.5 text-xs font-semibold text-yellow-700 dark:text-yellow-500 whitespace-nowrap">
								{relocated && <TriangleAlertFilledIcon className="shrink-0" size={12} />}
								{relocated ? m.stop_call_relocated() : m.stop_call_temporary()}
							</span>
						)}
					</div>
				</div>
				{onLocate !== undefined && (
					<span className="flex w-4 shrink-0 justify-end">
						{locatable && (
							<LocateIcon
								aria-hidden="true"
								className="size-3.5 text-muted-foreground transition-colors group-has-[button:hover]:text-foreground"
							/>
						)}
					</span>
				)}
			</div>
		</li>
	);
}

export type DepartureListRow = {
	departure: StopDeparture;
	line?: Line;
	label: string;
	key: string;
	wheelchairStatus?: WheelchairStatus;
	relocated?: boolean;
	stopLabel?: string;
};

type DeparturesListProps = {
	direction: StopCallDirection;
	rows: DepartureListRow[];
	isError: boolean;
	isLoading: boolean;
	messages: { error: string; loading: string; empty: string };
	touch?: boolean;
	/** Classes de la zone défilante. */
	scrollClassName: string;
	onLocate?: (journeyId: string) => void;
};

export function DeparturesList({
	direction,
	rows,
	isError,
	isLoading,
	messages,
	touch,
	scrollClassName,
	onLocate,
}: Readonly<DeparturesListProps>) {
	const message = isError
		? messages.error
		: isLoading
			? messages.loading
			: rows.length === 0
				? messages.empty
				: undefined;

	if (message !== undefined) {
		if (isLoading && !isError) {
			return <p className="m-auto px-3 py-3 text-center text-sm text-muted-foreground">{message}</p>;
		}
		return (
			<div className="p-3">
				<p className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
					<InfoIcon className="size-4 shrink-0" />
					{message}
				</p>
			</div>
		);
	}

	// La zone défilante ne porte pas la marge intérieure : posée sur la liste qu'elle contient, elle
	// reste entre le contenu et la barre de défilement, contre laquelle l'heure viendrait sinon se coller.
	return (
		<div className={clsx("overflow-y-auto overscroll-contain", scrollClassName)}>
			<ul className={clsx("divide-y py-0.5", touch ? "px-2" : "px-1")}>
				{rows.map(({ departure, line, label, wheelchairStatus, relocated, stopLabel, key }) => (
					<DepartureRow
						departure={departure}
						direction={direction}
						key={key}
						line={line}
						label={label}
						relocated={relocated}
						stopLabel={stopLabel}
						touch={touch}
						wheelchairStatus={wheelchairStatus}
						onLocate={onLocate}
					/>
				))}
			</ul>
		</div>
	);
}

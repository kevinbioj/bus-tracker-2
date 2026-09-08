import type { VehicleJourneyCall } from "@bus-tracker/contracts";
import { clsx } from "clsx";
import dayjs from "dayjs";
import { ArrowDownRight, ArrowUpRight, Rss } from "lucide-react";
import { memo } from "react";
import { match, P } from "ts-pattern";

import { CustomTooltip } from "~/components/custom-tooltip";
import { type NextCallsDisplayMode, useNextCallsDisplayMode } from "~/components/vehicles-map/next-calls-display-mode";
import { useDebouncedMemo } from "~/hooks/use-debounced-memo";
import * as m from "~/paraglide/messages";

type NextStopsProps = { calls: VehicleJourneyCall[]; tooltipId?: string };

type NextStopRowProps = {
	call: VehicleJourneyCall;
	displayMode: NextCallsDisplayMode;
	label: string;
};

type CallTimes = {
	/** Heure d'arrivée effective (temps réel si connu), repliée sur le départ si inexploitable. */
	arrival: string;
	/** Heure de départ effective (temps réel si connu) — au terminus, c'est l'heure d'arrivée. */
	departure: string;
	/** Heure théorique de référence pour le calcul du retard, alignée sur l'heure affichée. */
	aimed: string;
	/** Heure temps réel de référence, si connue. */
	expected?: string;
};

/**
 * Choisit les heures à afficher pour un arrêt.
 *
 * Le contrat ne publie l'heure d'arrivée que lorsqu'elle diffère du départ. On l'utilise alors comme
 * heure par défaut de l'arrêt, le départ ne servant qu'à afficher « arrivée → départ » pendant le
 * stationnement.
 */
/** Heure locale de l'arrêt : l'offset est retiré pour ne pas afficher celle du visiteur. */
const formatLocalTime = (time: string) => dayjs(time.slice(0, -6)).format("HH:mm");

function getCallTimes(call: VehicleJourneyCall): CallTimes {
	const departure = call.expectedTime ?? call.aimedTime;
	const fallback = { arrival: departure, departure, aimed: call.aimedTime, expected: call.expectedTime };

	// L'arrivée n'est exploitable qu'au même niveau que le départ (théorique ou temps réel) : opposer
	// une arrivée théorique à un départ temps réel décalerait la bascule vers « à l'arrêt ».
	if (call.aimedArrivalTime === undefined) return fallback;
	if ((call.expectedArrivalTime !== undefined) !== (call.expectedTime !== undefined)) return fallback;

	const arrival = call.expectedArrivalTime ?? call.aimedArrivalTime;
	// Garde-fou sur des données incohérentes : une arrivée postérieure au départ est ignorée.
	if (dayjs(arrival).isAfter(departure)) return fallback;

	return { arrival, departure, aimed: call.aimedArrivalTime, expected: call.expectedArrivalTime };
}

// Le détail de la course est rafraîchi en boucle, mais le partage structurel de React Query garde
// la référence d'un arrêt inchangé : mémoïser la ligne limite le rendu aux arrêts qui ont bougé.
const NextStopRow = memo(function NextStopRow({ call, displayMode, label }: Readonly<NextStopRowProps>) {
	const { aimed, expected } = getCallTimes(call);

	const accentColor = match([call.callStatus, expected])
		.with(["SKIPPED", P.any], () => "text-red-700 dark:text-red-500")
		.with(["SCHEDULED", P.string], () => "text-green-700 dark:text-green-500")
		.with(["UNSCHEDULED", P.string], () => "text-yellow-700 dark:text-yellow-500")
		.otherwise(() => null);

	const tooltipProps =
		expected !== undefined || call.callStatus === "SKIPPED"
			? match([call.callStatus, dayjs(expected ?? aimed).diff(aimed, "minutes")])
					.with(
						["SKIPPED", P.any],
						() =>
							({
								className: "bg-red-600 dark:bg-red-700 font-bold text-white",
								content: m.stop_call_skipped(),
							}) as const,
					)
					.with(
						["UNSCHEDULED", P.any],
						() =>
							({
								className: "bg-yellow-700 dark:bg-yellow-500 font-bold text-white dark:text-black",
								content: m.stop_call_extra(),
							}) as const,
					)
					.with(
						["SCHEDULED", P.number.positive()],
						([, delay]) =>
							({
								className: "bg-orange-600 dark:bg-orange-700 font-bold text-white",
								content: m.stop_call_delay({ count: delay }),
							}) as const,
					)
					.with(
						["SCHEDULED", P.number.negative()],
						([, delay]) =>
							({
								className: "bg-red-600 dark:bg-red-700 font-bold text-white",
								content: m.stop_call_early({ count: Math.abs(delay) }),
							}) as const,
					)
					.otherwise(
						() =>
							({
								className: "bg-green-600 dark:bg-green-700 font-bold text-white",
								content: m.stop_call_on_time(),
							}) as const,
					)
			: null;

	const hasExtra = (call.flags !== undefined && call.flags.length > 0) || call.platformName !== undefined;

	const children = (
		<div className={clsx("flex font-bold ml-2", accentColor)}>
			{expected !== undefined || call.callStatus === "SKIPPED" ? (
				<Rss className={clsx("-rotate-90 mr-[0.5px]", accentColor)} size={8} />
			) : null}
			<span
				className={clsx(
					// `whitespace-nowrap` : à quai, le libellé s'allonge (deux heures, ou « À quai - … »).
					"select-none whitespace-nowrap hover:cursor-default",
					call.callStatus === "SKIPPED" && displayMode === "absolute" && "line-through",
				)}
			>
				{label}
			</span>
		</div>
	);

	return (
		<div className="flex gap-1">
			<div
				className={clsx("font-bold overflow-hidden text-ellipsis whitespace-nowrap", !hasExtra && "flex-1")}
				title={call.stopName}
			>
				{call.stopName}
			</div>
			{hasExtra && (
				<div className="flex-1">
					{call.platformName !== undefined && (
						<span className="inline-block ml-px bg-foreground/80 dark:bg-foreground text-background font-bold px-1 min-w-4 text-center rounded-xs">
							{call.platformName}
						</span>
					)}
					{call.flags !== undefined && call.flags.length > 0 && (
						<span>
							{match(call.flags)
								.with(["NO_DROP_OFF"], () => (
									<ArrowUpRight className="inline size-4 text-slate-500 dark:text-slate-400" />
								))
								.with(["NO_PICKUP"], () => (
									<ArrowDownRight className="inline size-4 text-slate-500 dark:text-slate-400" />
								))
								.otherwise(() => null)}
						</span>
					)}
				</div>
			)}
			{tooltipProps ? (
				<CustomTooltip {...tooltipProps} place="left" spacing={8}>
					{children}
				</CustomTooltip>
			) : (
				children
			)}
		</div>
	);
});

export const VehicleNextStops = memo(function VehicleNextStops({ calls }: Readonly<NextStopsProps>) {
	const [nextCallsDisplayMode] = useNextCallsDisplayMode();

	const times = useDebouncedMemo(
		() => {
			const now = dayjs();

			return calls.map((call) => {
				const { arrival, departure } = getCallTimes(call);
				// Véhicule à quai : entre son arrivée et son départ, c'est le départ qui reste à venir,
				// et lui seul intéresse l'utilisateur. Un arrêt supprimé n'étant pas desservi, il en est exclu.
				const dwelling =
					arrival !== departure && call.callStatus !== "SKIPPED" && !now.isBefore(arrival) && !now.isAfter(departure);

				if (nextCallsDisplayMode === "absolute") {
					return dwelling
						? m.stop_call_dwelling_departure_at({ time: formatLocalTime(departure) })
						: formatLocalTime(arrival);
				}

				if (call.callStatus === "SKIPPED") return m.stop_call_cancelled();

				const minutes = dayjs(dwelling ? departure : arrival).diff(now, "minutes");
				if (minutes < 1) return dwelling ? m.stop_call_dwelling_imminent() : m.stop_call_imminent();

				const countdown =
					minutes < 60
						? m.stop_call_in_minutes({ count: minutes })
						: m.stop_call_in_hours({
								hours: Math.floor(minutes / 60),
								minutes: String(minutes % 60).padStart(2, "0"),
							});

				return dwelling ? m.stop_call_dwelling_departure({ time: countdown }) : countdown;
			});
		},
		// Un stationnement dure souvent moins d'une minute : la bascule vers « arrivée → départ »
		// doit suivre le rythme de rafraîchissement de la course elle-même.
		5_000,
		[calls, nextCallsDisplayMode],
	);

	if (calls.length === 0) return null;
	return (
		<div className="-my-0.5">
			<div className="flex max-h-24 flex-col gap-1 overflow-y-auto overscroll-contain py-0.5 px-1.5">
				{calls.map((call, index) => (
					<NextStopRow call={call} displayMode={nextCallsDisplayMode} key={call.stopOrder} label={times[index] ?? ""} />
				))}
			</div>
		</div>
	);
});

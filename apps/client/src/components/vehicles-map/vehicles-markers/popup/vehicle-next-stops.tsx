import type { VehicleJourneyCall } from "@bus-tracker/contracts";
import { clsx } from "clsx";
import dayjs from "dayjs";
import { ArrowDownRight, ArrowUpRight, Rss } from "lucide-react";
import { match, P } from "ts-pattern";

import { CustomTooltip } from "~/components/ui/custom-tooltip";

type NextStopsProps = { calls: VehicleJourneyCall[]; tooltipId?: string };

export function VehicleNextStops({ calls }: Readonly<NextStopsProps>) {
	if (calls.length === 0) return null;
	return (
		<div className="-my-0.5">
			<div className="flex max-h-24 flex-col gap-1 overflow-y-auto overscroll-contain py-0.5 px-1.5">
				{calls.map((call) => {
					const timeWithoutZone = (call.expectedTime ?? call.aimedTime).slice(0, -6);

					const accentColor = match([call.callStatus, call.expectedTime])
						.with(["SKIPPED", P.any], () => "text-red-700 dark:text-red-500")
						.with(["SCHEDULED", P.string], () => "text-green-700 dark:text-green-500")
						.with(["UNSCHEDULED", P.string], () => "text-yellow-700 dark:text-yellow-500")
						.otherwise(() => null);

					const tooltipProps =
						typeof call.expectedTime !== "undefined" || call.callStatus === "SKIPPED"
							? match([call.callStatus, dayjs(call.expectedTime ?? call.aimedTime).diff(call.aimedTime, "minutes")])
									.with(
										["SKIPPED", P.any],
										() =>
											({
												className: "bg-red-600 dark:bg-red-700 font-bold text-white",
												content: "Arrêt non desservi",
											}) as const,
									)
									.with(
										["UNSCHEDULED", P.any],
										() =>
											({
												className: "bg-yellow-700 dark:bg-yellow-500 font-bold text-white dark:text-black",
												content: "Desserte supplémentaire",
											}) as const,
									)
									.with(
										["SCHEDULED", P.number.positive()],
										([, delay]) =>
											({
												className: "bg-orange-600 dark:bg-orange-700 font-bold text-white",
												content: `Retard de ${delay} minute${delay > 1 ? "s" : ""}`,
											}) as const,
									)
									.with(
										["SCHEDULED", P.number.negative()],
										([, delay]) =>
											({
												className: "bg-red-600 dark:bg-red-700 font-bold text-white",
												content: `Avance de ${Math.abs(delay)} minute${delay < -1 ? "s" : ""}`,
											}) as const,
									)
									.otherwise(
										() =>
											({
												className: "bg-green-600 dark:bg-green-700 font-bold text-white",
												content: "À l'heure",
											}) as const,
									)
							: null;

					const hasExtra =
						(typeof call.flags !== "undefined" && call.flags.length > 0) || typeof call.platformName !== "undefined";

					const children = (
						<div className={clsx("flex font-bold", accentColor)}>
							{typeof call.expectedTime !== "undefined" || call.callStatus === "SKIPPED" ? (
								<Rss className={clsx("-rotate-90 mr-[0.5px]", accentColor)} size={8} />
							) : null}
							<span
								className={clsx("select-none hover:cursor-default", call.callStatus === "SKIPPED" && "line-through")}
							>
								{dayjs(timeWithoutZone).format("HH:mm")}
							</span>
						</div>
					);

					return (
						<div className="flex gap-1" key={call.stopOrder}>
							<div
								className={clsx("font-bold overflow-hidden text-ellipsis whitespace-nowrap", !hasExtra && "flex-1")}
								title={call.stopName}
							>
								{call.stopName}
							</div>
							{hasExtra && (
								<div className="flex-1">
									{typeof call.platformName !== "undefined" && (
										<span className="border-[0.5px] border-foreground leading-none px-0.5 pt-[1px] text-[9px] text-nowrap uppercase">
											{call.platformName}
										</span>
									)}
									{typeof call.flags !== "undefined" && call.flags.length > 0 && (
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
				})}
			</div>
		</div>
	);
}

import type { VehicleJourneyCall } from "@bus-tracker/contracts";
import { clsx } from "clsx";
import dayjs from "dayjs";
import { ArrowDownRight, ArrowUpRight, Rss } from "lucide-react";
import { match, P } from "ts-pattern";

import { CustomTooltip } from "~/components/custom-tooltip";
import { useNextCallsDisplayMode } from "~/components/vehicles-map/next-calls-display-mode";
import { useDebouncedMemo } from "~/hooks/use-debounced-memo";
import * as m from "~/paraglide/messages";

type NextStopsProps = { calls: VehicleJourneyCall[]; tooltipId?: string };

export function VehicleNextStops({ calls }: Readonly<NextStopsProps>) {
	const [nextCallsDisplayMode] = useNextCallsDisplayMode();

	const times = useDebouncedMemo(
		() =>
			calls.map((call) => {
				const time = call.expectedTime ?? call.aimedTime;
				if (nextCallsDisplayMode === "absolute") {
					return dayjs(time.slice(0, -6)).format("HH:mm");
				}

				if (call.callStatus === "SKIPPED") return m.stop_call_cancelled();

				const minutes = dayjs(time).diff(dayjs(), "minutes");
				if (minutes < 1) return m.stop_call_imminent();
				if (minutes < 60) return m.stop_call_in_minutes({ count: minutes });

				return m.stop_call_in_hours({
					hours: Math.floor(minutes / 60),
					minutes: String(minutes % 60).padStart(2, "0"),
				});
			}),
		10_000,
		[calls, nextCallsDisplayMode],
	);

	if (calls.length === 0) return null;
	return (
		<div className="-my-0.5">
			<div className="flex max-h-24 flex-col gap-1 overflow-y-auto overscroll-contain py-0.5 px-1.5">
				{calls.map((call, index) => {
					const label = times[index] ?? "";

					const accentColor = match([call.callStatus, call.expectedTime])
						.with(["SKIPPED", P.any], () => "text-red-700 dark:text-red-500")
						.with(["SCHEDULED", P.string], () => "text-green-700 dark:text-green-500")
						.with(["UNSCHEDULED", P.string], () => "text-yellow-700 dark:text-yellow-500")
						.otherwise(() => null);

					const tooltipProps =
						call.expectedTime !== undefined || call.callStatus === "SKIPPED"
							? match([call.callStatus, dayjs(call.expectedTime ?? call.aimedTime).diff(call.aimedTime, "minutes")])
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
						<div className={clsx("flex font-bold", accentColor)}>
							{call.expectedTime !== undefined || call.callStatus === "SKIPPED" ? (
								<Rss className={clsx("-rotate-90 mr-[0.5px]", accentColor)} size={8} />
							) : null}
							<span
								className={clsx(
									"select-none hover:cursor-default",
									call.callStatus === "SKIPPED" && nextCallsDisplayMode === "absolute" && "line-through",
								)}
							>
								{label}
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
				})}
			</div>
		</div>
	);
}

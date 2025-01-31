import type { VehicleJourneyCall } from "@bus-tracker/contracts";
import { clsx } from "clsx";
import dayjs from "dayjs";
import { Rss } from "lucide-react";
import { P, match } from "ts-pattern";

import { CustomTooltip } from "~/components/ui/custom-tooltip";

type NextStopsProps = { calls: VehicleJourneyCall[]; tooltipId?: string };

export function VehicleNextStops({ calls }: Readonly<NextStopsProps>) {
	if (calls.length === 0) return null;
	return (
		<div className="px-2 -my-0.5">
			<div className="flex max-h-24 flex-col gap-1 overflow-y-auto py-0.5">
				{calls.map((call) => {
					const accentColor = match([call.callStatus, call.expectedTime])
						.with(["SKIPPED", P.any], () => "text-red-700 dark:text-red-500")
						.with(["SCHEDULED", P.string], () => "text-green-700 dark:text-green-500")
						.otherwise(() => null);

					const tooltipProps =
						typeof call.expectedTime !== "undefined" || call.callStatus === "SKIPPED"
							? match([call.callStatus, dayjs(call.expectedTime ?? call.aimedTime).diff(call.aimedTime, "minutes")])
									.with(
										["SKIPPED", P.any],
										() =>
											({ className: "bg-red-600 dark:bg-red-700 text-white", content: "Arrêt non desservi" }) as const,
									)
									.with(
										["SCHEDULED", P.number.positive()],
										([, delay]) =>
											({
												className: "bg-orange-600 dark:bg-orange-700 text-white",
												content: `Retard de ${delay} minute${delay > 1 ? "s" : ""}`,
											}) as const,
									)
									.with(
										["SCHEDULED", P.number.negative()],
										([, delay]) =>
											({
												className: "bg-red-600 dark:bg-red-700 text-white",
												content: `Avance de ${Math.abs(delay)} minute${delay < -1 ? "s" : ""}`,
											}) as const,
									)
									.otherwise(
										() => ({ className: "bg-green-600 dark:bg-green-700 text-white", content: "À l'heure" }) as const,
									)
							: null;

					const children = (
						<div className={clsx("flex", accentColor)}>
							{typeof call.expectedTime !== "undefined" || call.callStatus === "SKIPPED" ? (
								<Rss className={clsx("-rotate-90 mr-[0.5px]", accentColor)} size={8} />
							) : null}
							<span
								className={clsx("select-none hover:cursor-default", call.callStatus === "SKIPPED" && "line-through")}
							>
								{dayjs(call.expectedTime ?? call.aimedTime).format("HH:mm")}
							</span>
						</div>
					);

					return (
						<div className="flex gap-0.5 font-bold" key={call.stopOrder}>
							<div className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{call.stopName}</div>
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

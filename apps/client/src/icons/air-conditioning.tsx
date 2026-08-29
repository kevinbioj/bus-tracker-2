import { clsx } from "clsx";
import { SnowflakeIcon } from "lucide-react";

import type { VehicleAirConditioningStatus } from "~/api/vehicles";
import { m } from "~/paraglide/messages";
import { cn } from "~/utils/cn";

export const airConditioningIconDetails = {
	PRESENT: {
		disabled: false,
		iconClass: "text-sky-600 dark:text-sky-400",
		chipClasses: "bg-sky-700 dark:bg-sky-600 text-white",
		label: m.marker_air_conditioning_present,
	},
	OUT_OF_SERVICE: {
		disabled: true,
		iconClass: "text-red-600 dark:text-red-400",
		chipClasses: "bg-red-700 dark:bg-red-600 text-white",
		label: m.marker_air_conditioning_out_of_service,
	},
	ABSENT: {
		disabled: true,
		iconClass: "text-red-600 dark:text-red-400",
		chipClasses: "bg-red-700 dark:bg-red-600 text-white",
		label: m.marker_air_conditioning_absent,
	},
} as const;

export function AirConditioningIcon({
	className,
	status,
	tone = "default",
}: Readonly<{ className?: string; status: VehicleAirConditioningStatus; tone?: "default" | "on-color" }>) {
	const airConditioningInformation = airConditioningIconDetails[status];
	const onColor = tone === "on-color";

	return (
		<span className={cn("relative inline-flex size-4 align-middle", className)}>
			<SnowflakeIcon className={clsx("size-full", onColor ? "text-current" : airConditioningInformation.iconClass)} />
			{airConditioningInformation.disabled && (
				<>
					<span
						className={clsx(
							"absolute left-1/2 top-[calc(50%+1px)] h-1 w-[125%] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full",
							onColor ? "bg-black/25" : "bg-background",
						)}
						aria-hidden="true"
					/>
					<span
						className={clsx(
							"absolute left-1/2 top-1/2 h-0.5 w-[125%] -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full",
							onColor ? "bg-current" : "bg-red-600 dark:bg-red-400",
						)}
						aria-hidden="true"
					/>
				</>
			)}
		</span>
	);
}

import { clsx } from "clsx";
import { SnowflakeIcon } from "lucide-react";

import type { VehicleAirConditioningStatus } from "~/api/vehicles";
import { m } from "~/paraglide/messages";

export const airConditioningIconDetails = {
	PRESENT: {
		disabled: false,
		iconClass: "text-sky-600 dark:text-sky-400",
		tooltipClasses: "bg-sky-600 dark:bg-sky-700 text-white",
		tooltipText: m.marker_air_conditioning_present,
	},
	OUT_OF_SERVICE: {
		disabled: true,
		iconClass: "text-red-600 dark:text-red-400",
		tooltipClasses: "bg-red-600 dark:bg-red-700 text-white",
		tooltipText: m.marker_air_conditioning_out_of_service,
	},
	ABSENT: {
		disabled: true,
		iconClass: "text-red-600 dark:text-red-400",
		tooltipClasses: "bg-red-600 dark:bg-red-700 text-white",
		tooltipText: m.marker_air_conditioning_absent,
	},
} as const;

export function AirConditioningIcon({
	className,
	status,
}: Readonly<{ className?: string; status: VehicleAirConditioningStatus }>) {
	const airConditioningInformation = airConditioningIconDetails[status];

	return (
		<span className={clsx("relative inline-flex size-4 align-middle", className)}>
			<SnowflakeIcon className={clsx("size-4", airConditioningInformation.iconClass)} />
			{airConditioningInformation.disabled && (
				<>
					<span
						className="absolute left-1/2 top-[calc(50%+1px)] h-1 w-5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-background"
						aria-hidden="true"
					/>
					<span
						className="absolute left-1/2 top-1/2 h-0.5 w-5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-red-600 dark:bg-red-400"
						aria-hidden="true"
					/>
				</>
			)}
		</span>
	);
}

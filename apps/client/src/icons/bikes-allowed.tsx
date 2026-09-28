import { clsx } from "clsx";
import { BikeIcon } from "lucide-react";

import { m } from "~/paraglide/messages";
import { cn } from "~/utils/cn";

export type BikesAllowedStatus = "allowed" | "not-allowed" | "unknown";

/** Prise en charge des vélos d'une valeur publiée : absente, elle est inconnue. */
export const getBikesAllowedStatus = (value: boolean | undefined): BikesAllowedStatus =>
	value === undefined ? "unknown" : value ? "allowed" : "not-allowed";

export const bikesAllowedIconDetails = {
	allowed: {
		iconClass: "text-emerald-600 dark:text-emerald-400",
		chipClasses: "bg-emerald-700 dark:bg-emerald-600 text-white",
		label: m.bikes_allowed,
	},
	"not-allowed": {
		iconClass: "text-red-600 dark:text-red-400",
		chipClasses: "bg-red-700 dark:bg-red-600 text-white",
		label: m.bikes_not_allowed,
	},
	unknown: {
		iconClass: "text-muted-foreground",
		chipClasses: "bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100",
		label: m.bikes_allowed_unknown,
	},
} as const satisfies Record<BikesAllowedStatus, unknown>;

/**
 * Pictogramme de la prise en charge des vélos : barré lorsqu'ils ne sont pas acceptés, marqué d'un
 * point d'interrogation lorsqu'on n'en sait rien.
 */
export function BikesAllowedIcon({
	className,
	status,
	tone = "default",
}: Readonly<{ className?: string; status: BikesAllowedStatus; tone?: "default" | "on-color" }>) {
	const details = bikesAllowedIconDetails[status];
	const onColor = tone === "on-color";

	return (
		<span className={cn("relative inline-flex size-4 cursor-[inherit] select-none align-middle", className)}>
			<BikeIcon
				aria-hidden="true"
				className={clsx("size-full", onColor ? "text-current" : details.iconClass)}
				strokeWidth={2.5}
			/>
			{status === "not-allowed" && (
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
			{status === "unknown" && (
				<span
					className={clsx(
						"absolute -right-1 -bottom-1 flex size-[55%] items-center justify-center rounded-full text-[0.5rem] font-bold leading-none",
						onColor
							? "bg-neutral-800 text-neutral-100 dark:bg-neutral-100 dark:text-neutral-800"
							: "bg-muted-foreground text-background",
					)}
					aria-hidden="true"
				>
					?
				</span>
			)}
		</span>
	);
}

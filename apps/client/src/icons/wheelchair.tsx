import { clsx } from "clsx";

import { m } from "~/paraglide/messages";
import { cn } from "~/utils/cn";

export type WheelchairStatus = "accessible" | "inaccessible" | "unknown";

/** État d'accessibilité d'une valeur publiée : absente, elle est inconnue. */
export const getWheelchairStatus = (value: boolean | undefined): WheelchairStatus =>
	value === undefined ? "unknown" : value ? "accessible" : "inaccessible";

export const wheelchairIconDetails = {
	accessible: {
		iconClass: "text-sky-600 dark:text-sky-400",
		chipClasses: "bg-sky-700 dark:bg-sky-600 text-white",
		label: m.wheelchair_accessible,
	},
	inaccessible: {
		iconClass: "text-red-600 dark:text-red-400",
		chipClasses: "bg-red-700 dark:bg-red-600 text-white",
		label: m.wheelchair_inaccessible,
	},
	unknown: {
		iconClass: "text-muted-foreground",
		chipClasses: "bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100",
		label: m.wheelchair_unknown,
	},
} as const satisfies Record<WheelchairStatus, unknown>;

/**
 * Pictogramme d'accessibilité en fauteuil roulant : barré lorsque l'accès n'est pas possible, marqué
 * d'un point d'interrogation lorsqu'il est inconnu.
 */
export function WheelchairIcon({
	className,
	status,
	tone = "default",
}: Readonly<{ className?: string; status: WheelchairStatus; tone?: "default" | "on-color" }>) {
	const details = wheelchairIconDetails[status];
	const onColor = tone === "on-color";

	return (
		<span className={cn("relative inline-flex size-4 cursor-[inherit] select-none align-middle", className)}>
			{/* Fauteuil roulant du pictogramme international (ISO 7001) : la silhouette assise, droite. */}
			<svg
				aria-hidden="true"
				className={clsx("size-full", onColor ? "text-current" : details.iconClass)}
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2.5}
				viewBox="0 0 24 24"
			>
				<circle cx="10" cy="3.5" fill="currentColor" r="2.25" stroke="none" />
				<path d="M10 7.5v5.5h5l2.5 6h2" />
				<path d="M10 10h4" />
				<path d="M7 12.2A5 5 0 1 0 14.2 18.2" />
			</svg>
			{status === "inaccessible" && (
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

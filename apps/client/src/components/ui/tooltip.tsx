import clsx from "clsx";
import { type ComponentPropsWithoutRef, useMemo, useState } from "react";
import { match } from "ts-pattern";
import { twMerge } from "tw-merge";

export type TooltipProps = ComponentPropsWithoutRef<"span"> & {
	content: React.ReactNode;
	place: "top" | "left" | "bottom" | "right";
	spacing?: number;
	show?: "hover" | "click";
};

export function Tooltip({ children, content, place, spacing = 5, ...tooltipProps }: TooltipProps) {
	const [open, setOpen] = useState(false);

	const tooltipStyles = useMemo(
		() =>
			match(place)
				.with("top", () => ({ bottom: `calc(100% + ${spacing}px)`, left: "50%", transform: "translateX(-50%)" }))
				.with("left", () => ({ top: "50%", right: `calc(100% + ${spacing}px)`, transform: "translateY(-50%)" }))
				.with("bottom", () => ({ top: `calc(100% + ${spacing}px)`, left: "50%", transform: "transformX(-50%)" }))
				.with("right", () => ({ top: "50%", left: `calc(100% + ${spacing}px)`, transform: "transformX(-50%)" }))
				.exhaustive(),
		[place, spacing],
	);

	const { className, style, ...props } = tooltipProps;
	return (
		<div className="relative inline-block" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
			{children}
			<span
				className={twMerge(
					clsx(
						"absolute whitespace-nowrap rounded-md bg-neutral-300 px-1 py-0.5 text-black text-xs shadow-lg dark:bg-neutral-700 dark:text-white",
						!open && "hidden",
						className,
					),
				)}
				role="tooltip"
				style={{ ...style, ...tooltipStyles }}
				{...props}
			>
				{content}
			</span>
		</div>
	);
}

import { ChevronRightIcon, StarIcon } from "lucide-react";
import type React from "react";
import { memo } from "react";

import type { Line } from "~/api/networks";
import * as m from "~/paraglide/messages";
import { cn } from "~/utils/cn";

export function OnlineVehiclesCount({ count, className }: Readonly<{ count: number; className?: string }>) {
	return (
		<span className={cn("flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums", className)}>
			{count}
			<span className="size-1.5 animate-pulse rounded-full bg-green-500 ring-1 ring-current" />
		</span>
	);
}

function lineNumberTextSize(number: string) {
	if (number.length > 28) return "text-base";
	if (number.length > 14) return "text-lg";
	if (number.length > 6) return "text-xl";
	return "text-2xl";
}

export type FilterModuleLineCardProps = {
	line: Line;
	isFavorite: boolean;
	onToggleFavorite: (line: Line) => void;
	onSelect?: (line: Line) => void;
};

export const FilterModuleLineCard = memo(function FilterModuleLineCard({
	line,
	isFavorite,
	onToggleFavorite,
	onSelect,
}: FilterModuleLineCardProps) {
	const lineLabel = line.girouetteNumber ? line.number : m.network_lines_label({ lineNumber: line.number });
	const onlineCount = line.onlineMarkerCount ?? 0;
	const textColor = line.textColor ?? "#FFFFFF";

	return (
		<div
			className="relative h-full px-3 py-[3px]"
			style={{ "--line-text": textColor, color: textColor } as React.CSSProperties}
		>
			<button
				aria-label={`${lineLabel}, ${m.network_online_vehicle_count({ count: onlineCount })}`}
				className={cn(
					"flex h-full w-full items-center gap-3 rounded-lg border border-black/10 pr-3 text-left shadow-xs transition outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-branding/60 focus-visible:ring-offset-1 focus-visible:ring-offset-popover dark:border-white/10",
					line.cartridgeHref === null ? "pl-3" : "py-0.5 pl-0.5",
					onlineCount === 0 && "brightness-90 saturate-[.85] hover:brightness-100",
				)}
				onClick={() => onSelect?.(line)}
				style={{ backgroundColor: line.color ?? "#18181B" }}
				type="button"
			>
				<span aria-hidden="true" className="flex h-full min-w-0 flex-1 items-center">
					{line.cartridgeHref === null ? (
						<span className={cn("line-clamp-2 font-bold leading-tight break-words", lineNumberTextSize(line.number))}>
							{line.number}
						</span>
					) : (
						<img alt="" className="h-full max-w-28 object-contain object-left" src={line.cartridgeHref} />
					)}
				</span>
				<span className="flex shrink-0 items-center gap-0.5">
					{onlineCount > 0 && <OnlineVehiclesCount className="text-base font-bold" count={onlineCount} />}
					<span aria-hidden="true" className="size-8 shrink-0" />
					<ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 opacity-70" />
				</span>
			</button>
			<button
				aria-label={m.map_favorite_toggle({ name: lineLabel })}
				aria-pressed={isFavorite}
				className="absolute top-1/2 right-[42px] flex size-8 -translate-y-1/2 items-center justify-center rounded-md transition-colors outline-none hover:bg-[color-mix(in_srgb,var(--line-text)_15%,transparent)] focus-visible:ring-2 focus-visible:ring-branding/60"
				onClick={() => onToggleFavorite(line)}
				type="button"
			>
				<StarIcon className={cn("size-4", isFavorite ? "fill-yellow-400 stroke-yellow-600" : "opacity-70")} />
			</button>
		</div>
	);
});

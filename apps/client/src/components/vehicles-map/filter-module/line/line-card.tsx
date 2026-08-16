import { ArrowRight, StarIcon } from "lucide-react";
import type React from "react";
import { memo } from "react";

import type { Line } from "~/api/networks";
import { Button } from "~/components/ui/button";
import { cn } from "~/utils/cn";

function lineNumberTextSize(number: string) {
	if (number.length > 40) return "text-sm";
	if (number.length > 28) return "text-base";
	if (number.length > 18) return "text-lg";
	return "text-xl";
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
	return (
		<div
			className="card-item px-3 py-0.5 relative w-full"
			style={line.textColor ? ({ "--line-text-color": line.textColor } as React.CSSProperties) : undefined}
		>
			<Button
				className="absolute top-4 left-4.5 z-10 hover:bg-inherit hover:opacity-75 favorite-line-background"
				onClick={() => onToggleFavorite(line)}
				size="icon"
				variant="ghost"
				style={{ color: line.textColor ?? undefined }}
			>
				{isFavorite ? <StarIcon className="fill-yellow-400 stroke-yellow-600" /> : <StarIcon />}
			</Button>
			<Button
				className={cn(
					"border border-border flex justify-between items-center h-16 min-h-16 px-2 py-1 pl-12 rounded-lg transition text-primary-foreground w-full drop-shadow-xs",
					!line.onlineMarkerCount && "brightness-90 cursor-not-allowed",
				)}
				onClick={() => onSelect?.(line)}
				style={{
					backgroundColor: line.color ?? undefined,
					color: line.textColor ?? undefined,
				}}
			>
				<div className="flex flex-1 items-center h-full gap-2 min-w-0">
					{line.cartridgeHref === null ? (
						<p
							className={cn(
								"align-middle font-bold flex-1 min-w-12 leading-tight text-left text-balance whitespace-normal break-words line-clamp-2",
								lineNumberTextSize(line.number),
							)}
						>
							{line.number}
						</p>
					) : (
						<img className="h-full max-w-24" src={line.cartridgeHref} alt={line.number} />
					)}
					{typeof line.onlineMarkerCount === "number" && line.onlineMarkerCount > 0 ? (
						<p className="align-middle font-bold text-xl text-end shrink-0 ml-auto relative">
							{line.onlineMarkerCount}
							<span
								className="absolute animate-pulse border top-0 -right-1.5 bg-green-600 rounded-full size-1.5"
								style={{
									borderColor: line.textColor ?? undefined,
								}}
							/>
						</p>
					) : null}
				</div>
				<ArrowRight />
			</Button>
		</div>
	);
});

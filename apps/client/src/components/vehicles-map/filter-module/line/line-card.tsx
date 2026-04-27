import { ArrowRight, StarIcon } from "lucide-react";
import { memo } from "react";

import type { Line } from "~/api/networks";
import { Button } from "~/components/ui/button";
import { cn } from "~/utils/utils";

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
		<div className="h-16 relative w-full">
			{line.textColor && (
				<style>
					{`@scope {
						.favorite-line-background:hover {
							background-color: ${line.textColor}22;
						}
					}`}
				</style>
			)}
			<Button
				className="absolute top-3.5 left-1.5 z-10 hover:bg-inherit hover:opacity-75 favorite-line-background"
				onClick={() => onToggleFavorite(line)}
				size="icon"
				variant="ghost"
				style={{ color: line.textColor ?? undefined }}
			>
				{isFavorite ? <StarIcon className="fill-yellow-400 stroke-yellow-600" /> : <StarIcon />}
			</Button>
			<Button
				className={cn(
					"border border-border flex justify-between items-center h-16 min-h-16 p-2 pl-12 rounded-lg transition text-primary-foreground w-full",
					!line.onlineMarkerCount && "brightness-90 cursor-not-allowed",
				)}
				onClick={() => onSelect?.(line)}
				style={{
					backgroundColor: line.color ?? undefined,
					color: line.textColor ?? undefined,
				}}
			>
				<div className="flex flex-1 items-center h-full gap-2">
					{line.cartridgeHref === null ? (
						<p className="align-middle font-bold min-w-12 text-xl">{line.number}</p>
					) : (
						<img className="h-full max-w-24" src={line.cartridgeHref} alt={line.number} />
					)}
					{typeof line.onlineMarkerCount === "number" && line.onlineMarkerCount > 0 ? (
						<p className="align-middle font-bold text-xl text-end flex-1 text-wrap relative">
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

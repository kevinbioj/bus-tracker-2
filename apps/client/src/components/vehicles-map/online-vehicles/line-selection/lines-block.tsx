import type { ReactNode } from "react";

import type { Line } from "~/api/networks";
import { TitleSeparator } from "~/components/ui/title-separator";
import { OnlineVehiclesLineCard } from "~/components/vehicles-map/online-vehicles/line-selection/online-vehicles-line-card";

type LinesBlockProps = {
	title?: ReactNode;
	lines: Line[];
	favoriteBlock?: boolean;
	onSelect?: (line: Line) => unknown;
	onToggleFavorite: (line: Line) => unknown;
};

export function LinesBlock({ title, lines, favoriteBlock, onSelect, onToggleFavorite }: LinesBlockProps) {
	return (
		<div>
			{title && <TitleSeparator className="flex items-center gap-2">{title}</TitleSeparator>}
			<ul className="mt-2 flex flex-col gap-1">
				{lines.map((line) => (
					<li key={line.id}>
						<OnlineVehiclesLineCard
							key={line.id}
							line={line}
							isFavorite={favoriteBlock ?? false}
							onSelect={onSelect}
							onToggleFavorite={onToggleFavorite}
						/>
					</li>
				))}
			</ul>
		</div>
	);
}

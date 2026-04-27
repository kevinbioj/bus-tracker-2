import type { ReactNode } from "react";

import type { Line } from "~/api/networks";
import { TitleSeparator } from "~/components/ui/title-separator";
import { FilterModuleLineCard } from "~/components/vehicles-map/filter-module/line/line-card";

type FilterModuleLinesBlock = {
	title?: ReactNode;
	lines: Line[];
	favoriteBlock?: boolean;
	onSelect?: (line: Line) => unknown;
	onToggleFavorite: (line: Line) => unknown;
};

export function LinesBlock({ title, lines, favoriteBlock, onSelect, onToggleFavorite }: FilterModuleLinesBlock) {
	return (
		<div>
			{title && <TitleSeparator className="flex items-center gap-2">{title}</TitleSeparator>}
			<ul className="mt-2 flex flex-col gap-1">
				{lines.map((line) => (
					<li key={line.id}>
						<FilterModuleLineCard
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

import { ChevronRightIcon, StarIcon } from "lucide-react";
import type { ReactNode } from "react";

import * as m from "~/paraglide/messages";
import { cn } from "~/utils/cn";

export function FilterModuleSectionLabel({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<h3 className="flex h-full items-end gap-1.5 px-4 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
			{children}
		</h3>
	);
}

export function FavoritesSectionIcon() {
	return <StarIcon className="size-3 fill-yellow-400 stroke-yellow-600" />;
}

type FilterModuleListRowProps = {
	children: ReactNode;
	label: string;
	favoriteName: string;
	isFavorite: boolean;
	dimmed?: boolean;
	onSelect: () => void;
	onToggleFavorite: () => void;
};

export function FilterModuleListRow({
	children,
	label,
	favoriteName,
	isFavorite,
	dimmed = false,
	onSelect,
	onToggleFavorite,
}: Readonly<FilterModuleListRowProps>) {
	return (
		<div className="relative h-full px-2 py-0.5">
			<button
				aria-label={label}
				className="flex h-full w-full items-center gap-3 rounded-lg pr-2 pl-2 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-branding/50"
				onClick={onSelect}
				type="button"
			>
				<span aria-hidden="true" className={cn("flex min-w-0 flex-1 items-center gap-3", dimmed && "opacity-60")}>
					{children}
				</span>
				<span aria-hidden="true" className="size-8 shrink-0" />
				<ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
			</button>
			<button
				aria-label={m.map_favorite_toggle({ name: favoriteName })}
				aria-pressed={isFavorite}
				className={cn(
					"absolute top-1/2 right-8 flex size-8 -translate-y-1/2 items-center justify-center rounded-md transition-colors outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-branding/50",
					isFavorite ? "text-yellow-600" : "text-muted-foreground/60 hover:text-foreground",
				)}
				onClick={onToggleFavorite}
				type="button"
			>
				<StarIcon className={cn("size-4", isFavorite && "fill-yellow-400 stroke-yellow-600")} />
			</button>
		</div>
	);
}

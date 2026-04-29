import { useVirtualizer } from "@tanstack/react-virtual";
import { InfoIcon, StarIcon } from "lucide-react";
import { type ReactNode, type RefObject, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { Line } from "~/api/networks";
import { TitleSeparator } from "~/components/ui/title-separator";
import { FilterModuleLineCard } from "~/components/vehicles-map/filter-module/line/line-card";
import { cn } from "~/utils/utils";

type VirtualRow =
	| { kind: "separator"; key: string; title: ReactNode; first: boolean }
	| { kind: "line"; key: string; line: Line; isFavorite: boolean }
	| { kind: "info-banner"; key: string; runningCount: number; favoriteCount: number };

type LinesInnerListProps = {
	favoriteLines: Line[];
	runningLines: Line[];
	nonRunningLines: Line[];
	onLineSelect: (line: Line) => void;
	toggleFavoriteLineId: (line: Line) => void;
	scrollRef: RefObject<HTMLDivElement | null>;
};

export function LinesInnerList({
	favoriteLines,
	runningLines,
	nonRunningLines,
	onLineSelect,
	toggleFavoriteLineId,
	scrollRef,
}: LinesInnerListProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [scrollMargin, setScrollMargin] = useState(0);

	useLayoutEffect(() => {
		setScrollMargin(containerRef.current?.offsetTop ?? 0);
	}, []);

	const virtualRows = useMemo<VirtualRow[]>(() => {
		const rows: VirtualRow[] = [];
		let first = true;

		if (favoriteLines.length > 0) {
			rows.push({
				kind: "separator",
				key: "sep-favorites",
				title: (
					<>
						<StarIcon className="fill-yellow-400 stroke-yellow-600 size-5" /> Lignes favorites
					</>
				),
				first,
			});
			first = false;
			for (const line of favoriteLines) rows.push({ kind: "line", key: `line-${line.id}`, line, isFavorite: true });
		}

		if (runningLines.length > 0) {
			if (favoriteLines.length > 0) {
				rows.push({ kind: "separator", key: "sep-running", title: "Lignes en service", first });
				first = false;
			}
			for (const line of runningLines) rows.push({ kind: "line", key: `line-${line.id}`, line, isFavorite: false });
		}

		if (nonRunningLines.length > 0) {
			rows.push({
				kind: "info-banner",
				key: "info-banner",
				runningCount: runningLines.length,
				favoriteCount: favoriteLines.length,
			});
			for (const line of nonRunningLines) rows.push({ kind: "line", key: `line-${line.id}`, line, isFavorite: false });
		}

		return rows;
	}, [favoriteLines, runningLines, nonRunningLines]);

	const virtualizer = useVirtualizer({
		count: virtualRows.length,
		getScrollElement: () => scrollRef.current,
		getItemKey: (index) => virtualRows[index].key,
		estimateSize: (index) => {
			const row = virtualRows[index];
			if (row.kind === "separator") return row.first ? 32 : 44;
			if (row.kind === "info-banner") return 48;
			return 68; // h-16 (64px) + py-0.5 (4px)
		},
		overscan: 5,
		enabled: virtualRows.length > 0,
		scrollMargin,
	});

	return (
		<div ref={containerRef} className="pb-2">
			<div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
				{virtualizer.getVirtualItems().map((virtualItem) => {
					const row = virtualRows[virtualItem.index];
					return (
						<div
							key={virtualItem.key}
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								width: "100%",
								height: `${virtualItem.size}px`,
								transform: `translateY(${virtualItem.start - scrollMargin}px)`,
							}}
						>
							{row.kind === "separator" && (
								<div className={cn("px-3", !row.first && "pt-3")}>
									<TitleSeparator className="flex items-center gap-2">{row.title}</TitleSeparator>
								</div>
							)}
							{row.kind === "line" && (
								<FilterModuleLineCard
									line={row.line}
									isFavorite={row.isFavorite}
									onSelect={onLineSelect}
									onToggleFavorite={toggleFavoriteLineId}
								/>
							)}
							{row.kind === "info-banner" && (
								<div className="bg-neutral-200 dark:bg-neutral-700 text-muted-foreground text-xs text-center p-2 rounded-md my-1.5 mx-3">
									<InfoIcon className="inline size-4 align-text-bottom mr-1" />
									Aucun véhicule ne circule sur{" "}
									{row.runningCount > 0 ? "ces lignes" : row.favoriteCount > 0 ? "le reste du réseau" : "ce réseau"}.
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}

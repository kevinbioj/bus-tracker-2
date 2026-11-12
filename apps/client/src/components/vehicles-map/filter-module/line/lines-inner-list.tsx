import { useVirtualizer } from "@tanstack/react-virtual";
import { InfoIcon } from "lucide-react";
import { type ReactNode, type RefObject, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { Line } from "~/api/networks";
import { FilterModuleLineCard } from "~/components/vehicles-map/filter-module/line/line-card";
import { FavoritesSectionIcon, FilterModuleSectionLabel } from "~/components/vehicles-map/filter-module/list-row";
import * as m from "~/paraglide/messages";

type VirtualRow =
	| { kind: "separator"; key: string; title: ReactNode; first: boolean }
	| { kind: "line"; key: string; line: Line; isFavorite: boolean }
	| { kind: "info-banner"; key: string; runningCount: number; favoriteCount: number }
	| { kind: "no-result"; key: string };

type LinesInnerListProps = {
	favoriteLines: Line[];
	runningLines: Line[];
	nonRunningLines: Line[];
	/** Lorsqu'une recherche est en cours, remplace les groupes par les résultats classés par pertinence. */
	searchResults?: Line[] | null;
	favoriteLineIds: Set<number>;
	onLineSelect: (line: Line) => void;
	toggleFavoriteLineId: (line: Line) => void;
	scrollRef: RefObject<HTMLDivElement | null>;
};

export function LinesInnerList({
	favoriteLines,
	runningLines,
	nonRunningLines,
	searchResults,
	favoriteLineIds,
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

		if (searchResults != null) {
			if (searchResults.length === 0) {
				return [{ kind: "no-result", key: "no-result" }];
			}

			rows.push({ kind: "separator", key: "sep-search", title: m.map_lines_search_results(), first: true });
			for (const line of searchResults) {
				rows.push({ kind: "line", key: `line-${line.id}`, line, isFavorite: favoriteLineIds.has(line.id) });
			}
			return rows;
		}

		if (favoriteLines.length > 0) {
			rows.push({
				kind: "separator",
				key: "sep-favorites",
				title: (
					<>
						<FavoritesSectionIcon />
						{m.map_lines_favorites()}
					</>
				),
				first,
			});
			first = false;
			for (const line of favoriteLines) rows.push({ kind: "line", key: `line-${line.id}`, line, isFavorite: true });
		}

		if (runningLines.length > 0) {
			if (favoriteLines.length > 0) {
				rows.push({ kind: "separator", key: "sep-running", title: m.map_lines_running(), first });
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
	}, [favoriteLines, runningLines, nonRunningLines, searchResults, favoriteLineIds]);

	const virtualizer = useVirtualizer({
		count: virtualRows.length,
		getScrollElement: () => scrollRef.current,
		getItemKey: (index) => virtualRows[index].key,
		estimateSize: (index) => {
			const row = virtualRows[index];
			if (row.kind === "separator") return row.first ? 28 : 40;
			if (row.kind === "info-banner") return 52;
			if (row.kind === "no-result") return 80;
			return 62;
		},
		overscan: 5,
		enabled: virtualRows.length > 0,
		scrollMargin,
	});

	return (
		<div ref={containerRef} className="pb-3">
			<div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
				{virtualizer.getVirtualItems().map((virtualItem) => {
					const row = virtualRows[virtualItem.index];
					return (
						<div
							className="[will-change:transform]"
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
							{row.kind === "separator" && <FilterModuleSectionLabel>{row.title}</FilterModuleSectionLabel>}
							{row.kind === "line" && (
								<FilterModuleLineCard
									line={row.line}
									isFavorite={row.isFavorite}
									onSelect={onLineSelect}
									onToggleFavorite={toggleFavoriteLineId}
								/>
							)}
							{row.kind === "no-result" && (
								<p className="text-muted-foreground text-sm text-center px-6 py-6">{m.map_lines_search_empty()}</p>
							)}
							{row.kind === "info-banner" && (
								<div className="flex h-full items-end px-3 pb-1.5">
									<p className="flex w-full items-center gap-2 rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
										<InfoIcon className="size-4 shrink-0" />
										{row.runningCount > 0
											? m.map_lines_no_vehicle_these()
											: row.favoriteCount > 0
												? m.map_lines_no_vehicle_rest()
												: m.map_lines_no_vehicle_network()}
									</p>
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}

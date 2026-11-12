import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { ArrowLeftIcon, ChevronRightIcon, WaypointsIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebounceValue, useLocalStorage } from "usehooks-ts";

import type { Line } from "~/api/networks";
import { GetNetworkQuery, type Network } from "~/api/networks";
import { Button } from "~/components/ui/button";
import { SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Skeleton } from "~/components/ui/skeleton";
import { OnlineVehiclesCount } from "~/components/vehicles-map/filter-module/line/line-card";
import { LinesInnerList } from "~/components/vehicles-map/filter-module/line/lines-inner-list";
import { NetworkLogoTile } from "~/components/vehicles-map/filter-module/network/network-logo";
import { FilterModuleSearchBar } from "~/components/vehicles-map/filter-module/search-bar";
import * as m from "~/paraglide/messages";
import { cn } from "~/utils/cn";
import { searchLines } from "~/utils/line-search";

type FilterModuleLinesList = {
	network: Network;
	open: boolean;
	onBack?: () => void;
	onClose: () => void;
	onLineChange: (line?: Line) => void;
	/** Absent lorsque filtrer le réseau entier n'a pas de sens (mode embarqué). */
	onNetworkChange?: (network: Network) => void;
};

export function FilterModuleLinesList({
	network,
	open,
	onBack,
	onClose,
	onLineChange,
	onNetworkChange,
}: Readonly<FilterModuleLinesList>) {
	const { data: networkWithLines, isLoading, isPlaceholderData } = useQuery(GetNetworkQuery(network.id, true, open));

	const scrollRef = useRef<HTMLDivElement>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedSearchQuery] = useDebounceValue(searchQuery, 200);

	// Repartir du haut de la liste dès que les résultats changent.
	// biome-ignore lint/correctness/useExhaustiveDependencies: effect runs on query updates
	useEffect(() => {
		scrollRef.current?.scrollTo({ behavior: "smooth", top: 0 });
	}, [searchQuery]);

	// Une nouvelle sélection de réseau repart d'une recherche vierge.
	// biome-ignore lint/correctness/useExhaustiveDependencies: effect runs on network updates
	useEffect(() => {
		setSearchQuery("");
	}, [network.id]);

	const [favoriteLineIds, setFavoriteLineIds] = useLocalStorage("favorite-lines", new Set<number>(), {
		deserializer: (value) => new Set(JSON.parse(value)),
		serializer: (value) => JSON.stringify(Array.from(value.values())),
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: setters are not dependencies
	const toggleFavoriteLineId = useCallback(
		(line: Line) => {
			const updatedSet = new Set(favoriteLineIds);

			if (updatedSet.has(line.id)) {
				updatedSet.delete(line.id);
			} else {
				updatedSet.add(line.id);
			}

			setFavoriteLineIds(updatedSet);
		},
		[favoriteLineIds],
	);

	const [favoriteLines, runningLines, nonRunningLines] = useMemo<[Line[], Line[], Line[]]>(() => {
		if (networkWithLines?.lines === undefined) {
			return [[], [], []];
		}

		const groups = Map.groupBy(networkWithLines.lines, (line) => {
			if (line.archivedAt !== null && dayjs().isAfter(line.archivedAt)) {
				return "archived";
			}

			if (favoriteLineIds.has(line.id)) {
				return "favorite";
			}

			return line.onlineMarkerCount !== undefined && line.onlineMarkerCount > 0 ? "running" : "non-running";
		});
		return [groups.get("favorite") ?? [], groups.get("running") ?? [], groups.get("non-running") ?? []];
	}, [favoriteLineIds, networkWithLines]);

	const searchResults = useMemo(() => {
		if (debouncedSearchQuery.trim().length === 0 || networkWithLines?.lines === undefined) {
			return null;
		}

		const activeLines = networkWithLines.lines.filter(
			(line) => line.archivedAt === null || dayjs().isBefore(line.archivedAt),
		);
		return searchLines(activeLines, debouncedSearchQuery);
	}, [debouncedSearchQuery, networkWithLines]);

	const onlineVehicleCount = useMemo(
		() => networkWithLines?.lines?.reduce((total, line) => total + (line.onlineMarkerCount ?? 0), 0) ?? 0,
		[networkWithLines],
	);

	const loading = isLoading || isPlaceholderData;

	return (
		<div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-none">
			<SheetHeader className="sticky top-0 z-10 shrink-0 gap-0 border-b bg-popover p-0 text-popover-foreground">
				<div className={cn("flex items-center gap-2 py-1.5 pr-1.5", onBack ? "pl-1.5" : "pl-3")}>
					{onBack && (
						<Button
							aria-label={m.map_network_list_back()}
							className="size-7"
							onClick={onBack}
							size="icon"
							title={m.map_network_list_back()}
							variant="ghost"
						>
							<ArrowLeftIcon className="size-4" />
						</Button>
					)}
					<NetworkLogoTile className="h-8 w-12" network={network} />
					<SheetTitle className="grid min-w-0 flex-1 gap-0.5">
						<span className="truncate text-sm font-semibold leading-tight">{network.name}</span>
						{network.authority && (
							<span className="truncate text-xs font-normal leading-tight text-muted-foreground">
								{network.authority}
							</span>
						)}
					</SheetTitle>
					<Button className="size-7" onClick={onClose} size="icon" title={m.common_close()} variant="ghost">
						<XIcon className="size-4" />
					</Button>
				</div>
				<div className="flex flex-col gap-2 px-3 pb-3">
					{onNetworkChange && (
						<button
							className="flex h-10 w-full items-center gap-2.5 rounded-lg bg-branding/10 px-3 text-sm font-medium text-branding transition-colors outline-none hover:bg-branding hover:text-branding-foreground focus-visible:ring-2 focus-visible:ring-branding/50 dark:bg-branding/40 dark:text-branding-foreground dark:hover:bg-branding"
							onClick={() => onNetworkChange(network)}
							type="button"
						>
							<WaypointsIcon className="size-4 shrink-0" />
							<span className="flex-1 text-left">{m.map_filter_whole_network()}</span>
							{!loading && onlineVehicleCount > 0 && <OnlineVehiclesCount count={onlineVehicleCount} />}
							<ChevronRightIcon className="size-4 shrink-0 opacity-70" />
						</button>
					)}
					<FilterModuleSearchBar
						placeholder={m.map_lines_search_placeholder()}
						query={searchQuery}
						onQueryChange={setSearchQuery}
					/>
				</div>
			</SheetHeader>
			{loading ? (
				<div className="flex flex-col gap-1 px-2 pt-8">
					{Array.from({ length: 10 }).map((_, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: safe here
						<Skeleton className="h-12 w-full shrink-0 rounded-lg" key={index} />
					))}
				</div>
			) : (
				<div className="pt-1">
					<LinesInnerList
						favoriteLines={favoriteLines}
						runningLines={runningLines}
						nonRunningLines={nonRunningLines}
						searchResults={searchResults}
						favoriteLineIds={favoriteLineIds}
						onLineSelect={onLineChange}
						toggleFavoriteLineId={toggleFavoriteLineId}
						scrollRef={scrollRef}
					/>
				</div>
			)}
		</div>
	);
}

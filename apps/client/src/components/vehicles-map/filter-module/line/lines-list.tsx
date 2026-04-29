import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { ArrowLeft } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";
import { useLocalStorage } from "usehooks-ts";

import type { Line } from "~/api/networks";
import { GetNetworkQuery, type Network } from "~/api/networks";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Skeleton } from "~/components/ui/skeleton";
import { LinesInnerList } from "~/components/vehicles-map/filter-module/line/lines-inner-list";

type FilterModuleLinesList = {
	network?: Network;
	onClose: () => void;
	onLineChange: (line?: Line) => void;
};

export function FilterModuleLinesList({ network, onClose, onLineChange }: Readonly<FilterModuleLinesList>) {
	const { data: networkWithLines, isLoading, isPlaceholderData } = useQuery(GetNetworkQuery(network?.id, true, true));

	const currentNetwork = useRef(network);

	if (network !== undefined) {
		currentNetwork.current = network;
	}

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

	const scrollRef = useRef<HTMLDivElement>(null);

	return (
		<Sheet open={network !== undefined} onOpenChange={(open) => !open && onClose()}>
			<SheetContent ref={scrollRef} className="z-999 gap-0 overflow-y-auto overscroll-none" showCloseButton={false}>
				<SheetHeader className="pt-4 pb-1.5 shrink-0 sticky top-0 z-9999 bg-background">
					<div className="flex items-start gap-2">
						<Button className="size-6" onClick={onClose} size="icon" variant="branding-default">
							<ArrowLeft className="size-full" />
						</Button>
						<SheetTitle className="flex flex-col">
							<span className="font-bold leading-tight text-lg">{currentNetwork.current?.name}</span>
							{currentNetwork.current?.authority && (
								<span className="leading-none text-sm uppercase">{currentNetwork.current.authority}</span>
							)}
						</SheetTitle>
					</div>
				</SheetHeader>
				{isLoading || isPlaceholderData ? (
					<div className="flex flex-col gap-1">
						{Array.from({ length: 10 }).map((_, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: safe here
							<Skeleton className="bg-neutral-200 h-16 w-full shrink-0" key={index} />
						))}
					</div>
				) : (
					<LinesInnerList
						favoriteLines={favoriteLines}
						runningLines={runningLines}
						nonRunningLines={nonRunningLines}
						onLineSelect={onLineChange}
						toggleFavoriteLineId={toggleFavoriteLineId}
						scrollRef={scrollRef}
					/>
				)}
			</SheetContent>
		</Sheet>
	);
}

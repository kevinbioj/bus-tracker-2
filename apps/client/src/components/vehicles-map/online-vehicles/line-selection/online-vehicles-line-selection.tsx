import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { ArrowLeft, Info, StarIcon } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useLocalStorage } from "usehooks-ts";

import type { Line } from "~/api/networks";
import { GetNetworkQuery, type Network } from "~/api/networks";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Skeleton } from "~/components/ui/skeleton";
import { LinesBlock } from "~/components/vehicles-map/online-vehicles/line-selection/lines-block";

type OnlineVehiclesLineSelectionProps = {
	network?: Network;
	onClose: () => void;
	onLineChange: (line?: Line) => void;
};

export function OnlineVehiclesLineSelection({
	network,
	onClose,
	onLineChange,
}: Readonly<OnlineVehiclesLineSelectionProps>) {
	const { data: networkWithLines, isLoading } = useQuery(GetNetworkQuery(network?.id, true, true));

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

	return (
		<Sheet open={network !== undefined} onOpenChange={(open) => !open && onClose()}>
			<SheetContent className="z-999 gap-0" showCloseButton={false}>
				<SheetHeader className="py-3 shrink-0">
					<div className="flex items-center gap-2">
						<Button className="size-6" onClick={onClose} size="icon" variant="branding-default">
							<ArrowLeft className="size-full" />
						</Button>
						<SheetTitle>{network?.name}</SheetTitle>
					</div>
				</SheetHeader>
				{isLoading ? (
					<div className="mx-3 flex flex-col gap-1">
						{Array.from({ length: 10 }).map((_, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: safe here
							<Skeleton className="bg-neutral-200 h-16 w-full shrink-0" key={index} />
						))}
					</div>
				) : (
					<div className="mx-3 flex flex-col gap-3 overflow-y-auto pb-2">
						{/* Favorite lines */}
						{favoriteLines.length > 0 && (
							<LinesBlock
								favoriteBlock
								title={
									<>
										<StarIcon className="fill-yellow-400 stroke-yellow-600 size-5" /> Lignes favorites
									</>
								}
								lines={favoriteLines}
								onSelect={onLineChange}
								onToggleFavorite={toggleFavoriteLineId}
							/>
						)}
						{/* Running lines */}
						{runningLines.length > 0 && (
							<LinesBlock
								title={favoriteLines.length > 0 ? "Lignes en service" : undefined}
								lines={runningLines}
								onSelect={onLineChange}
								onToggleFavorite={toggleFavoriteLineId}
							/>
						)}
						{/* Non-running lines */}
						{nonRunningLines.length > 0 && (
							<div>
								<div className="bg-neutral-200 text-muted-foreground text-xs text-center p-2 rounded-md mb-1">
									<Info className="inline size-4 align-text-bottom mr-1" /> Aucun véhicule ne circule sur{" "}
									{runningLines.length > 0
										? "ces lignes"
										: favoriteLines.length > 0
											? "le reste du réseau"
											: "ce réseau"}
									.
								</div>
								<LinesBlock lines={nonRunningLines} onToggleFavorite={toggleFavoriteLineId} />
							</div>
						)}
					</div>
				)}
			</SheetContent>
		</Sheet>
	);
}

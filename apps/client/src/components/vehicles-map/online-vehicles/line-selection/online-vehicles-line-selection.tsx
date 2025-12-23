import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { ArrowLeft, ArrowRight, Info } from "lucide-react";
import { useMemo } from "react";

import type { Line } from "~/api/networks";
import { GetNetworkQuery, type Network } from "~/api/networks";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/utils/utils";

type OnlineVehiclesLineSelection = {
	container: HTMLDivElement | null;
	network?: Network;
	onClose: () => void;
	onLineChange: (line?: Line) => void;
	withBackdrop?: boolean;
};

export function OnlineVehiclesLineSelection({
	container,
	network,
	onClose,
	onLineChange,
	withBackdrop = false,
}: OnlineVehiclesLineSelection) {
	const { data: networkWithLines, isLoading } = useQuery(GetNetworkQuery(network?.id, true, true));

	const [linesWithVehicles, linesWithoutVehicles] = useMemo(
		() =>
			(networkWithLines?.lines ?? [])
				.filter((line) => line.archivedAt === null || dayjs().isBefore(line.archivedAt))
				.reduce(
					([withVehicles, withoutVehicles], line) => {
						if (typeof line.onlineVehicleCount === "number" && line.onlineVehicleCount > 0) {
							withVehicles.push(line);
						} else {
							withoutVehicles.push(line);
						}
						return [withVehicles, withoutVehicles];
					},
					[[], []] as [Line[], Line[]],
				),
		[networkWithLines],
	);

	const renderLine = (line: Line) => (
		<Button
			className={cn(
				"border border-border flex justify-between items-center h-16 min-h-16 p-2 rounded-lg transition text-primary-foreground hover:brightness-90",
				!line.onlineVehicleCount && "brightness-90 cursor-not-allowed",
			)}
			key={line.id}
			onClick={() => onLineChange(line)}
			style={{
				backgroundColor: line.color ?? undefined,
				color: line.textColor ?? undefined,
			}}
		>
			<div className="flex items-center h-full gap-2">
				{line.cartridgeHref !== null ? (
					<img className="h-full max-w-24" src={line.cartridgeHref} alt={line.number} />
				) : (
					<p className="align-middle font-bold min-w-12 text-xl">{line.number}</p>
				)}
				{typeof line.onlineVehicleCount === "number" && line.onlineVehicleCount > 0 ? (
					<p className="align-middle text-base text-wrap">
						<span className="font-bold">{line.onlineVehicleCount}</span> véhicule
						{line.onlineVehicleCount > 1 ? "s" : ""} en ligne
					</p>
				) : null}
			</div>
			<ArrowRight />
		</Button>
	);

	return (
		<Sheet open={typeof network !== "undefined"} onOpenChange={(open) => !open && onClose()}>
			<SheetContent
				aria-describedby={undefined}
				className="max-w-[90vw] w-full p-3"
				container={container}
				withBackdrop={withBackdrop}
				withCloseButton={false}
			>
				<SheetHeader className="mb-1.5">
					<div className="flex items-center gap-2">
						<Button className="size-6" onClick={onClose} size="icon" variant="branding-default">
							<ArrowLeft className="size-full" />
						</Button>
						<SheetTitle>{network?.name}</SheetTitle>
					</div>
				</SheetHeader>
				<div className="flex flex-col gap-1 h-[96%] overflow-y-auto py-1.5">
					{isLoading ? (
						Array.from({ length: 10 }).map((_, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: safe here
							<Skeleton className="h-16 w-full" key={index} />
						))
					) : (
						<>
							{linesWithVehicles.flatMap(renderLine)}
							{linesWithVehicles.length > 0 && linesWithoutVehicles.length > 0 && <Separator />}
							{linesWithoutVehicles.length > 0 && (
								<div className="bg-muted text-muted-foreground text-xs text-center p-2 rounded-md">
									<Info className="inline size-4 align-text-bottom mr-1" /> Aucun véhicule identifiable ne circule sur{" "}
									{linesWithVehicles.length > 0 ? "ces lignes" : "ce réseau"}.
								</div>
							)}
							{linesWithoutVehicles.flatMap(renderLine)}
						</>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}

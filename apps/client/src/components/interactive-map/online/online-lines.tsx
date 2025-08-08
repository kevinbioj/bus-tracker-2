import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Info } from "lucide-react";

import { GetNetworkQuery, type Line } from "~/api/networks";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { cn } from "~/utils/utils";

type OnlineLinesProps = {
	networkId: number;
	updateLine: (lineId: number) => void;
};

export function OnlineLines({ networkId, updateLine }: Readonly<OnlineLinesProps>) {
	const { data: network } = useQuery(GetNetworkQuery(networkId, true));
	if (!network) return null;

	const [linesWithVehicles, linesWithoutVehicles] = network.lines
		.filter((line) => line.archivedAt === null)
		.reduce<[Line[], Line[]]>(
			([withVehicles, withoutVehicles], line) => {
				if (typeof line.onlineVehicleCount === "number" && line.onlineVehicleCount > 0) {
					withVehicles.push(line);
				} else {
					withoutVehicles.push(line);
				}
				return [withVehicles, withoutVehicles];
			},
			[[], []],
		);

	const renderLine = (line: Line) => (
		<Button
			className={cn(
				"border border-border flex justify-between items-center h-16 p-2 rounded-lg transition text-primary-foreground hover:brightness-90",
				!line.onlineVehicleCount && "brightness-90 cursor-not-allowed",
			)}
			key={line.id}
			onClick={() => updateLine(line.id)}
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
		<div className="flex flex-col gap-1">
			{linesWithVehicles.flatMap(renderLine)}
			{linesWithVehicles.length > 0 && linesWithoutVehicles.length > 0 && <Separator />}
			{linesWithoutVehicles.length > 0 && (
				<div className="bg-muted text-muted-foreground text-xs text-center p-2 rounded-md">
					<Info className="inline size-4 align-text-bottom mr-1" /> Aucun véhicule identifiable ne circule sur{" "}
					{linesWithVehicles.length > 0 ? "ces lignes" : "ce réseau"}.
				</div>
			)}
			{linesWithoutVehicles.flatMap(renderLine)}
		</div>
	);
}

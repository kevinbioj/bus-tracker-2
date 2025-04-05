import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";

import { GetNetworkQuery } from "~/api/networks";
import { Button } from "~/components/ui/button";

type OnlineLinesProps = {
	networkId: number;
	updateLine: (lineId: number) => void;
};

export function OnlineLines({ networkId, updateLine }: Readonly<OnlineLinesProps>) {
	const { data: network } = useQuery(GetNetworkQuery(networkId));
	if (!network) return null;

	return (
		<div className="flex flex-col gap-3">
			{network.lines.flatMap((line) => {
				if (line.archivedAt !== null) return;

				return (
					<Button
						className="border border-border flex justify-between items-center h-16 p-2 rounded-lg transition text-primary-foreground hover:brightness-90"
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
			})}
		</div>
	);
}

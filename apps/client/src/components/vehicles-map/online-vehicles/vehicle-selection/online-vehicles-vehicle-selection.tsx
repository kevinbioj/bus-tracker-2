import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight } from "lucide-react";

import { GetLineOnlineVehiclesQuery } from "~/api/lines";
import type { Line, Network } from "~/api/networks";
import { OnlineVehiclesVehicleCard } from "~/components/vehicles-map/online-vehicles/vehicle-selection/online-vehicles-vehicle-card";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";

type OnlineVehiclesVehicleSelection = {
	network?: Network;
	line?: Line;
	onClose: () => void;
	onVehicleSelect: () => void;
};

export function OnlineVehiclesVehicleSelection({
	network,
	line,
	onClose,
	onVehicleSelect,
}: OnlineVehiclesVehicleSelection) {
	const { data: vehicles } = useQuery(GetLineOnlineVehiclesQuery(line?.id));
	if (typeof vehicles === "undefined") return null;

	const lineVehicles = vehicles.filter((vehicle) => vehicle.activity.lineId === line?.id);

	return (
		<Sheet open={typeof line !== "undefined"} onOpenChange={(open) => !open && onClose()}>
			<SheetContent
				aria-describedby={undefined}
				className="max-w-[90vw] p-3 w-full z-[7000] pointer-events-auto"
				withBackdrop={false}
				withCloseButton={false}
			>
				<SheetHeader className="mb-1.5">
					<div className="flex items-center gap-2">
						<Button className="size-6" onClick={onClose} size="icon" variant="branding-default">
							<ArrowLeft className="size-full" />
						</Button>
						<SheetTitle className="text-start">
							<span className="align-middle max-w-36 inline-block text-ellipsis overflow-x-hidden text-nowrap">
								{network?.name}
							</span>{" "}
							<ChevronRight className="align-text-bottom inline size-5" />{" "}
							<span className="align-middle max-w-24 inline-block text-ellipsis overflow-x-hidden text-nowrap">
								{line?.number}
							</span>
						</SheetTitle>
					</div>
				</SheetHeader>
				{lineVehicles.length > 0 ? (
					<div className="h-[96%] overflow-y-auto space-y-1 py-1.5">
						{lineVehicles
							.toSorted((a, b) => +a.number - +b.number)
							.map((vehicle) => (
								<OnlineVehiclesVehicleCard key={vehicle.id} vehicle={vehicle} onVehicleSelect={onVehicleSelect} />
							))}
					</div>
				) : (
					<p className="mt-3 text-center text-muted-foreground">Aucun véhicule ne circule sur cette ligne.</p>
				)}
			</SheetContent>
		</Sheet>
	);
}

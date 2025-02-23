import dayjs from "dayjs";
import { PinIcon } from "lucide-react";
import { useMap } from "react-leaflet";
import { Link } from "react-router-dom";
import { P, match } from "ts-pattern";

import type { Vehicle } from "~/api/vehicles";
import { useActiveMarker } from "~/components/interactive-map/active-marker/active-marker";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { useLine } from "~/hooks/use-line";
import { BusIcon, ShipIcon, TramwayIcon } from "~/icons/means-of-transport";

type OnlineVehicleCardProps = {
	closeSheet: () => void;
	vehicle: Vehicle;
};

export function OnlineVehicleCard({ closeSheet, vehicle }: Readonly<OnlineVehicleCardProps>) {
	const map = useMap();
	const { setActiveMarker } = useActiveMarker();
	const line = useLine(vehicle.networkId, vehicle.activity?.status === "online" ? vehicle.activity.lineId : undefined);

	const flyTo = () => {
		if (typeof vehicle.activity?.position === "undefined") return;
		closeSheet();

		map.setView(
			{
				lat: vehicle.activity.position.latitude,
				lng: vehicle.activity.position.longitude,
			},
			17,
			{ animate: true },
		);

		if (typeof vehicle.activity.markerId !== "undefined") {
			setActiveMarker(vehicle.activity.markerId);
		}
	};

	return (
		<div
			className={`flex flex-col relative rounded-md ${!line && "bg-neutral-200 text-black dark:bg-neutral-800 dark:text-white"}`}
			style={{ backgroundColor: line?.color ?? undefined, color: line?.textColor ?? undefined }}
		>
			<Link
				className="px-2 py-1 hover:brightness-90 transition bg-inherit rounded-md"
				to={`/data/vehicles/${vehicle.id}`}
			>
				<div className="flex justify-center">
					{match(vehicle.type)
						.with(P.union("SUBWAY", "TRAMWAY"), () => <TramwayIcon className="my-auto size-6" />)
						.with("FERRY", () => <ShipIcon className="my-auto size-6" />)
						.otherwise(() => (
							<BusIcon className="my-auto size-6" />
						))}
					<div
						className="border-l-[1px] border-black dark:border-white mx-2 my-1"
						style={{ borderColor: line?.textColor ?? undefined }}
					/>
					<h3 className="flex font-bold gap-1.5 justify-center ml-1 tabular-nums text-2xl">{vehicle.number}</h3>
				</div>
				<div
					className="border-t-[1px] border-black dark:border-white mx-2"
					style={{ borderColor: line?.textColor ?? undefined }}
				/>
				<div className="flex flex-col mt-2 w-full">
					{vehicle.designation && <p className="font-bold text-center">{vehicle.designation}</p>}
					{vehicle.activity?.status === "online" ? (
						<p className="text-center">
							En ligne depuis{" "}
							<span className="font-bold tabular-nums">{dayjs(vehicle.activity.since).format("HH:mm")}</span>
						</p>
					) : null}
				</div>
			</Link>
			{vehicle.activity.position && (
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button className="absolute bottom-0 right-0 rounded-md" onClick={flyTo} variant="inherit" size="icon">
								<PinIcon />
							</Button>
						</TooltipTrigger>
						<TooltipContent side="left">
							<p>Voir sur la carte</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			)}
		</div>
	);
}

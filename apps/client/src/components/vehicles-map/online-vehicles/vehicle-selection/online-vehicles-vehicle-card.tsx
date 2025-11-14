import { useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { LocateFixedIcon, LocateIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { P, match } from "ts-pattern";

import { GetVehicleJourneyQuery } from "~/api/vehicle-journeys";
import type { Vehicle } from "~/api/vehicles";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { useLine } from "~/hooks/use-line";
import { BusIcon, ShipIcon, TramwayIcon } from "~/icons/means-of-transport";

type OnlineVehiclesVehicleCard = {
	vehicle: Vehicle;
	onVehicleSelect: () => void;
};

export function OnlineVehiclesVehicleCard({ vehicle, onVehicleSelect }: Readonly<OnlineVehiclesVehicleCard>) {
	const queryClient = useQueryClient();
	const line = useLine(vehicle.networkId, vehicle.activity?.status === "online" ? vehicle.activity.lineId : undefined);

	const flyTo = () => {
		if (typeof vehicle.activity.markerId === "undefined") return;

		onVehicleSelect();
		queryClient.prefetchQuery(GetVehicleJourneyQuery(vehicle.activity.markerId));
	};

	return (
		<div
			className={`border border-border flex flex-col relative rounded-md shadow-md ${!line && "bg-neutral-200 text-black dark:bg-neutral-800 dark:text-white"}`}
			style={{
				backgroundColor: line?.color ?? undefined,
				color: line?.textColor ?? undefined,
			}}
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
				<div className="flex flex-col mt-2.5 w-full">
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
							<Button
								asChild
								className="absolute bottom-0 right-0 rounded-md group"
								onClick={flyTo}
								variant="inherit"
								size="icon"
							>
								<Link to={{ pathname: "/", search: `marker-id=${vehicle.activity.markerId}` }}>
									<LocateFixedIcon className="absolute opacity-0 group-hover:opacity-100 transition-opacity z-10" />
									<LocateIcon className="absolute opacity-100 group-hover:opacity-0 transition-opacity" />
								</Link>
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

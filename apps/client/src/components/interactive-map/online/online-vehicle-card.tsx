import dayjs from "dayjs";
import { BusFront, ShipIcon, TramFront } from "lucide-react";
import { Link } from "react-router-dom";
import { P, match } from "ts-pattern";

import type { Vehicle } from "~/api/vehicles";
import { useLine } from "~/hooks/use-line";

export function OnlineVehicleCard({ vehicle }: Readonly<{ vehicle: Vehicle }>) {
	const line = useLine(vehicle.networkId, vehicle.activity?.status === "online" ? vehicle.activity.lineId : undefined);

	return (
		<Link
			className={`flex flex-col py-1 px-2 rounded-md hover:brightness-90 ${
				!line && "bg-neutral-200 text-black dark:bg-neutral-800 dark:text-white"
			}`}
			to={`/data/vehicles/${vehicle.id}`}
			style={{ backgroundColor: line?.color ?? undefined, color: line?.textColor ?? undefined }}
		>
			<div className="flex justify-center">
				{match(vehicle.type)
					.with(P.union("SUBWAY", "TRAMWAY"), () => (
						<TramFront
							className="fill-neutral-200 dark:fill-neutral-800 h-6 my-auto w-6"
							style={{ fill: line?.color ?? undefined }}
						/>
					))
					.with("FERRY", () => (
						<ShipIcon
							className="fill-neutral-200 dark:fill-neutral-800 h-6 my-auto w-6"
							style={{ fill: line?.color ?? undefined }}
						/>
					))
					.otherwise(() => (
						<BusFront
							className="fill-neutral-200 dark:fill-neutral-800 h-6 my-auto w-6"
							style={{ fill: line?.color ?? undefined }}
						/>
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
	);
}

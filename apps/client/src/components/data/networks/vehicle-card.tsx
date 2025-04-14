import dayjs from "dayjs";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { P, match } from "ts-pattern";

import type { Vehicle } from "~/api/vehicles";
import { useLine } from "~/hooks/use-line";
import { BusIcon, ShipIcon, TramwayIcon } from "~/icons/means-of-transport";
import { Zzz } from "~/icons/zzz";

export function VehicleCard({ vehicle }: Readonly<{ vehicle: Vehicle }>) {
	const line = useLine(vehicle.networkId, vehicle.activity?.status === "online" ? vehicle.activity.lineId : undefined);

	const activeLine = useMemo(() => {
		if (typeof line === "undefined") return <Zzz className="h-full mx-auto" />;
		return line.cartridgeHref ? (
			<img className="h-full mx-auto object-contain" src={line.cartridgeHref} alt={line.number} />
		) : (
			<p className="flex items-center justify-center h-full font-bold text-2xl">{line.number}</p>
		);
	}, [line]);

	return (
		<Link
			className={`border border-border flex flex-col sm:flex-row py-1 px-2 rounded-md hover:brightness-90 ${
				!line && "bg-neutral-200 text-black dark:bg-neutral-800 dark:text-white"
			}`}
			to={`/data/vehicles/${vehicle.id}`}
			style={{
				backgroundColor: line?.color ?? undefined,
				color: line?.textColor ?? undefined,
			}}
		>
			<div className="flex justify-center">
				{match(vehicle.type)
					.with(P.union("SUBWAY", "TRAMWAY"), () => (
						<TramwayIcon className="my-auto size-6 sm:size-8" style={{ fill: line?.color ?? undefined }} />
					))
					.with("FERRY", () => (
						<ShipIcon className="my-auto size-6 sm:size-8" style={{ fill: line?.color ?? undefined }} />
					))
					.otherwise(() => (
						<BusIcon className="my-auto size-6 sm:size-8" style={{ fill: line?.color ?? undefined }} />
					))}
				<div
					className="border-l-[1px] border-black dark:border-white mx-2 my-1"
					style={{ borderColor: line?.textColor ?? undefined }}
				/>
				<h2 className="flex font-bold gap-1.5 justify-center ml-1 tabular-nums text-2xl sm:my-auto sm:text-4xl sm:min-w-32">
					{vehicle.number}
				</h2>
			</div>
			<div
				className="border-t-[1px] sm:border-l-[1px] border-black dark:border-white mx-2"
				style={{ borderColor: line?.textColor ?? undefined }}
			/>
			<div className="flex gap-2 flex-1 mt-2 mx-2 sm:mt-0 sm:mx-0">
				<div className="h-12 min-w-16 max-w-24">{activeLine}</div>
				<div className="flex flex-col justify-center">
					{vehicle.designation && <p className="font-bold">{vehicle.designation}</p>}
					{vehicle.activity?.status === "online" ? (
						<p>
							En circulation depuis{" "}
							<span className="font-bold tabular-nums">{dayjs(vehicle.activity.since).format("HH:mm")}</span>
						</p>
					) : (
						<p>
							Hors-ligne
							{vehicle.activity.since !== null && (
								<>
									{" "}
									depuis le{" "}
									{dayjs().diff(vehicle.activity.since, "years") >= 1 ? (
										<span className="font-bold tabular-nums">{dayjs(vehicle.activity.since).format("DD/MM/YYYY")}</span>
									) : (
										<>
											<span className="font-bold tabular-nums">{dayjs(vehicle.activity.since).format("DD/MM")}</span> à{" "}
											<span className="font-bold tabular-nums">{dayjs(vehicle.activity.since).format("HH:mm")}</span>
										</>
									)}
								</>
							)}
						</p>
					)}
				</div>
			</div>
		</Link>
	);
}

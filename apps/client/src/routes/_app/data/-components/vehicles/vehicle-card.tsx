import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import { ArchiveIcon } from "lucide-react";
import { useMemo } from "react";
import {
	TbArrowRight as ArrowRightIcon,
	TbCash as CashIcon,
	TbEngine as EngineIcon,
	TbFireExtinguisher as FireExtinguisherIcon,
	TbSkull as SkullIcon,
} from "react-icons/tb";
import { match, P } from "ts-pattern";
import { GetNetworkQuery } from "~/api/networks";

import type { Vehicle } from "~/api/vehicles";
import { useLine } from "~/hooks/use-line";
import { BusIcon, CoachIcon, GondolaIcon, ShipIcon, TramwayIcon, TrolleybusIcon } from "~/icons/means-of-transport";
import { Zzz } from "~/icons/zzz";
import * as m from "~/paraglide/messages";
import { dayjsTz } from "~/utils/timezone";

function lineNumberTextSize(number: string) {
	if (number.length > 12) return "text-sm";
	if (number.length > 8) return "text-lg";
	return "text-2xl";
}

const vehicleTypeLabel = (type: Vehicle["type"]) =>
	match(type)
		.with("SUBWAY", () => m.vehicle_type_subway())
		.with("TRAMWAY", () => m.vehicle_type_tramway())
		.with("FERRY", () => m.vehicle_type_ferry())
		.with("TROLLEY", () => m.vehicle_type_trolley())
		.with("COACH", () => m.vehicle_type_coach())
		.with("GONDOLA", () => m.vehicle_type_gondola())
		.with("BUS", () => m.vehicle_type_bus())
		.with("RAIL", () => m.vehicle_type_rail())
		.with("FUNICULAR", () => m.vehicle_type_funicular())
		.with("UNKNOWN", () => m.vehicle_type_other())
		.exhaustive();

export function VehicleCard({ vehicle }: Readonly<{ vehicle: Vehicle }>) {
	const line = useLine(vehicle.networkId, vehicle.activity?.status === "online" ? vehicle.activity.lineId : undefined);
	const { data: network } = useQuery(GetNetworkQuery(vehicle.networkId, true));

	const activeLine = useMemo(() => {
		if (vehicle.archivedAt !== null) {
			return match(vehicle.archivedFor)
				.with("FAILURE", () => <EngineIcon className="size-full" />)
				.with("FIRE", () => <FireExtinguisherIcon className="size-full" />)
				.with("RETIRED", () => <SkullIcon className="size-full" />)
				.with("SOLD", () => <CashIcon className="size-full" />)
				.with("TRANSFER", () => <ArrowRightIcon className="size-full" />)
				.otherwise(() => <ArchiveIcon className="size-full" />);
		}

		if (line === undefined) return <Zzz aria-hidden="true" className="h-full mx-auto" />;

		return line.cartridgeHref ? (
			<img alt="" className="h-full max-w-full mx-auto object-contain" src={line.cartridgeHref} />
		) : (
			<p
				className={`font-bold text-center leading-tight wrap-break-words line-clamp-2 ${lineNumberTextSize(line.number)}`}
			>
				{line.number}
			</p>
		);
	}, [line, vehicle]);

	const accessibleLabel = useMemo(() => {
		const timezone = network?.timezone;
		const dateTime = (date: string) => {
			const at = dayjsTz(date, timezone);
			return dayjs().diff(date, "years") >= 1
				? { date: at.format("DD/MM/YYYY") }
				: { date: at.format("DD/MM"), time: at.format("HH:mm") };
		};

		let status: string;
		if (vehicle.archivedAt !== null) {
			const { date, time } = dateTime(vehicle.archivedAt);
			status = [m.vehicle_details_archived_at(), date, time && `${m.vehicle_time_at()} ${time}`]
				.filter(Boolean)
				.join(" ");
		} else if (vehicle.activity?.status === "online") {
			const since = m.vehicle_card_since_time({ time: dayjsTz(vehicle.activity.since, timezone).format("HH:mm") });
			const lineLabel =
				line === undefined
					? undefined
					: line.girouetteNumber
						? line.number
						: m.vehicle_card_line({ lineNumber: line.number });
			status = `${lineLabel ? m.vehicle_card_online_on_line({ line: lineLabel }) : m.vehicle_card_online()} ${since}`;
		} else if (vehicle.activity.since !== null) {
			const { date, time } = dateTime(vehicle.activity.since);
			const since = time ? m.vehicle_card_since_date_time({ date, time }) : m.vehicle_card_since_date({ date });
			status = `${m.vehicle_card_offline()} ${since}`;
		} else {
			status = m.vehicle_card_offline();
		}

		return [`${vehicleTypeLabel(vehicle.type)} n°${vehicle.number}`, vehicle.designation, status]
			.filter(Boolean)
			.join(" ");
	}, [line, network?.timezone, vehicle]);

	return (
		<Link
			aria-label={accessibleLabel}
			className={`border border-border flex flex-col sm:flex-row py-1 px-2 rounded-md hover:brightness-90 active:not-aria-[haspopup]:translate-y-px transition-all ${
				!line && "bg-neutral-200 text-black dark:bg-neutral-800 dark:text-white"
			}`}
			to="/data/vehicles/$vehicleId"
			params={{ vehicleId: String(vehicle.id) }}
			style={{
				backgroundColor: line?.color ?? undefined,
				color: line?.textColor ?? undefined,
			}}
		>
			<div className="flex justify-center">
				{match(vehicle.type)
					.with(P.union("SUBWAY", "TRAMWAY"), () => (
						<TramwayIcon
							aria-hidden="true"
							className="my-auto size-6 sm:size-8"
							style={{ fill: line?.color ?? undefined }}
						/>
					))
					.with("FERRY", () => (
						<ShipIcon
							aria-hidden="true"
							className="my-auto size-6 sm:size-8"
							style={{ fill: line?.color ?? undefined }}
						/>
					))
					.with("TROLLEY", () => (
						<TrolleybusIcon
							aria-hidden="true"
							className="my-auto size-6 sm:size-8"
							style={{ fill: line?.color ?? undefined }}
						/>
					))
					.with("COACH", () => (
						<CoachIcon
							aria-hidden="true"
							className="my-auto size-6 sm:size-8"
							style={{ fill: line?.color ?? undefined }}
						/>
					))
					.with("GONDOLA", () => (
						<GondolaIcon
							aria-hidden="true"
							className="my-auto size-6 sm:size-8"
							style={{ fill: line?.color ?? undefined }}
						/>
					))
					.otherwise(() => (
						<BusIcon
							aria-hidden="true"
							className="my-auto size-6 sm:size-8"
							style={{ fill: line?.color ?? undefined }}
						/>
					))}
				<div
					className="border-l border-black dark:border-white mx-2 my-1"
					style={{ borderColor: line?.textColor ?? undefined }}
				/>
				<h2 className="flex font-bold gap-1.5 justify-center ml-1 tabular-nums text-2xl sm:my-auto sm:text-4xl sm:min-w-32">
					{vehicle.number}
				</h2>
			</div>
			<div
				className="border-t sm:border-l border-black dark:border-white mx-2 my-1"
				style={{ borderColor: line?.textColor ?? undefined }}
			/>
			<div className="flex gap-2 flex-1 mt-2 mx-2 sm:mt-0 sm:mx-0">
				<div className="flex items-center justify-center h-12 min-w-16 max-w-28 lg:max-w-36 shrink-0 overflow-hidden">
					{activeLine}
				</div>
				<div className="flex flex-col justify-center min-w-0 text-base">
					{vehicle.designation && <p className="font-bold">{vehicle.designation}</p>}
					{vehicle.activity?.status === "online" ? (
						<p>
							{m.vehicle_details_running_since()}{" "}
							<span className="font-bold tabular-nums">
								{dayjsTz(vehicle.activity.since, network?.timezone).format("HH:mm")}
							</span>
						</p>
					) : (
						<p>
							{vehicle.archivedAt ? (
								<>
									{m.vehicle_details_archived_at()}{" "}
									{dayjs().diff(vehicle.archivedAt, "years") >= 1 ? (
										<span className="font-bold tabular-nums">
											{dayjsTz(vehicle.archivedAt, network?.timezone).format("DD/MM/YYYY")}
										</span>
									) : (
										<>
											<span className="font-bold tabular-nums">
												{dayjsTz(vehicle.archivedAt, network?.timezone).format("DD/MM")}
											</span>{" "}
											{m.vehicle_time_at()}{" "}
											<span className="font-bold tabular-nums">
												{dayjsTz(vehicle.archivedAt, network?.timezone).format("HH:mm")}
											</span>
										</>
									)}
								</>
							) : (
								<>
									{m.vehicle_details_offline()}
									{vehicle.activity.since !== null && (
										<>
											{" "}
											{m.vehicle_details_offline_since()}{" "}
											{dayjs().diff(vehicle.activity.since, "years") >= 1 ? (
												<span className="font-bold tabular-nums">
													{dayjsTz(vehicle.activity.since, network?.timezone).format("DD/MM/YYYY")}
												</span>
											) : (
												<>
													<span className="font-bold tabular-nums">
														{dayjsTz(vehicle.activity.since, network?.timezone).format("DD/MM")}
													</span>{" "}
													{m.vehicle_time_at()}{" "}
													<span className="font-bold tabular-nums">
														{dayjsTz(vehicle.activity.since, network?.timezone).format("HH:mm")}
													</span>
												</>
											)}
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

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import dayjs from "dayjs";
import { HTTPError } from "ky";
import { SatelliteDishIcon } from "lucide-react";
import { useSnackbar } from "notistack";
import { useMemo, useState } from "react";
import { useLocalStorage } from "usehooks-ts";

import { GetNetworkQuery } from "~/api/networks";
import type { DisposeableVehicleJourney } from "~/api/vehicle-journeys";
import { CreateVehicleReportMutation } from "~/api/vehicles";
import { CustomTooltip } from "~/components/custom-tooltip";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "~/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { useDebouncedMemo } from "~/hooks/use-debounced-memo";
import { AirConditioningIcon, airConditioningIconDetails } from "~/icons/air-conditioning";
import { HighCrowdIcon } from "~/icons/crowd/high";
import { LowCrowdIcon } from "~/icons/crowd/low";
import { MediumCrowdIcon } from "~/icons/crowd/medium";
import { NoPassengersIcon } from "~/icons/crowd/no-passengers";
import * as m from "~/paraglide/messages";

const positionIconDetails = {
	GPS: {
		iconColor: "#38A169",
		tooltipClasses: "bg-green-600 dark:bg-green-700 text-white",
		tooltipText: m.marker_position_gps,
	},
	ESTIMATED: {
		iconColor: "#DD6B20",
		tooltipClasses: "bg-orange-600 dark:bg-orange-700 text-white",
		tooltipText: m.marker_position_estimated,
	},
	SCHEDULED: {
		iconColor: "#E53E3E",
		tooltipClasses: "bg-red-600 dark:bg-red-700 text-white",
		tooltipText: m.marker_position_scheduled,
	},
} as const;

const occupancyIconDetails = {
	LOW: {
		IconElement: LowCrowdIcon,
		iconClass: "fill-green-600 size-4",
		tooltipClasses: "bg-green-600 dark:bg-green-700 text-white",
		tooltipText: m.marker_occupancy_low,
	},
	MEDIUM: {
		IconElement: MediumCrowdIcon,
		iconClass: "fill-orange-600 size-5",
		tooltipClasses: "bg-orange-600 dark:bg-orange-700 text-white",
		tooltipText: m.marker_occupancy_medium,
	},
	HIGH: {
		IconElement: HighCrowdIcon,
		iconClass: "fill-red-600 size-5",
		tooltipClasses: "bg-red-600 dark:bg-red-700 text-white",
		tooltipText: m.marker_occupancy_high,
	},
	NO_PASSENGERS: {
		IconElement: NoPassengersIcon,
		iconClass: "fill-red-600 size-5",
		tooltipClasses: "bg-red-600 dark:bg-red-700 text-white",
		tooltipText: m.marker_occupancy_no_passengers,
	},
} as const;

const positiveReportButtonClasses =
	"text-sky-600 dark:text-sky-400 hover:text-sky-600 dark:hover:text-sky-400 bg-sky-600/10 hover:bg-sky-600/20 dark:bg-sky-600/20 dark:hover:bg-sky-600/30 focus-visible:border-sky-600/40 focus-visible:ring-sky-600/20";

const negativeReportButtonClasses =
	"text-red-600 dark:text-red-400 hover:text-red-600 dark:hover:text-red-400 bg-red-600/10 hover:bg-red-600/20 dark:bg-red-600/20 dark:hover:bg-red-600/30 focus-visible:border-red-600/40 focus-visible:ring-red-600/20";

type VehicleInformationProps = {
	disableLinks?: boolean;
	journey: DisposeableVehicleJourney;
};

export function VehicleInformation({ disableLinks, journey }: Readonly<VehicleInformationProps>) {
	const [displayAbsoluteTime] = useLocalStorage("display-absolute-time", false);
	const [airConditioningReportOpen, setAirConditioningReportOpen] = useState(false);
	const queryClient = useQueryClient();
	const snackbar = useSnackbar();

	const { data: network } = useQuery(GetNetworkQuery(journey.networkId, !journey.girouette));
	const { isPending: reportingAirConditioning, mutateAsync: reportAirConditioning } = useMutation(
		CreateVehicleReportMutation(journey.vehicle?.id ?? 0),
	);

	const recordedAt = useDebouncedMemo(
		() => {
			if (displayAbsoluteTime) return dayjs(journey.position.recordedAt).format("HH:mm:ss");
			if (dayjs().isBefore(journey.position.recordedAt)) return m.marker_before_departure();

			const duration = dayjs.duration(-dayjs().diff(journey.position.recordedAt));
			if (Math.abs(duration.asSeconds()) < 10) return m.marker_just_now();
			return duration.humanize(true);
		},
		3_000,
		[journey],
	);

	const networkIdentifier = network?.logoHref ? (
		<Tooltip>
			<TooltipTrigger
				render={
					<picture className="min-w-12 w-fit">
						{network.darkModeLogoHref !== null && (
							<source srcSet={network.darkModeLogoHref} media="(prefers-color-scheme: dark)" />
						)}
						<img className="h-5 object-contain m-auto" src={network.logoHref} alt="" />
					</picture>
				}
			/>
			<TooltipContent>{network.name}</TooltipContent>
		</Tooltip>
	) : (
		<span>{network?.name}</span>
	);

	const vehicleNumber = journey.vehicle ? `n°${journey.vehicle.number}` : undefined;

	const vehicleLink =
		journey.vehicle?.id && !disableLinks ? (
			<Button
				className="gap-0.5 p-0.5"
				size="xs"
				variant="ghost"
				nativeButton={false}
				render={
					<Link to="/data/vehicles/$vehicleId" params={{ vehicleId: String(journey.vehicle.id) }}>
						{vehicleNumber}
					</Link>
				}
			/>
		) : (
			<>{vehicleNumber} </>
		);

	const positionInformation = useMemo(() => {
		if (journey.position.type === "GPS") return positionIconDetails.GPS;
		return journey.calls?.some((call) => call.expectedTime !== undefined)
			? positionIconDetails.ESTIMATED
			: positionIconDetails.SCHEDULED;
	}, [journey]);

	const occupancyInformation = useMemo(() => {
		if (journey.occupancy === undefined) return;
		return occupancyIconDetails[journey.occupancy];
	}, [journey]);

	const airConditioningInformation = journey.vehicle?.airConditioning
		? airConditioningIconDetails[journey.vehicle.airConditioning]
		: undefined;
	const canReportAirConditioning =
		journey.vehicle?.id !== undefined &&
		(journey.vehicle.airConditioning === "PRESENT" || journey.vehicle.airConditioning === "OUT_OF_SERVICE");

	const closeAirConditioningReport = () => setAirConditioningReportOpen(false);

	const onAirConditioningReport = async (value: "PRESENT" | "OUT_OF_SERVICE") => {
		if (!canReportAirConditioning || journey.vehicle?.id === undefined) return;

		try {
			const result = await reportAirConditioning({ json: { field: "airConditioning", value } });
			snackbar.enqueueSnackbar(
				result.status === "applied"
					? m.marker_air_conditioning_report_applied()
					: m.marker_air_conditioning_report_recorded(),
				{ variant: "success" },
			);
			await queryClient.invalidateQueries({ queryKey: ["vehicle-journeys", journey.id] });
			await queryClient.invalidateQueries({ queryKey: ["vehicles", journey.vehicle.id] });
		} catch (error) {
			snackbar.enqueueSnackbar(
				error instanceof HTTPError && error.response.status === 409
					? m.marker_air_conditioning_report_duplicate()
					: m.marker_air_conditioning_report_error(),
				{ variant: "error" },
			);
		} finally {
			closeAirConditioningReport();
		}
	};

	return (
		<div className="grid grid-cols-[3.5rem_1fr_auto] px-1.5 py-1">
			{network?.hasVehiclesFeature ? (
				<Button
					size="xs"
					variant="ghost"
					nativeButton={false}
					render={
						disableLinks ? (
							networkIdentifier
						) : (
							<Link to="/data/networks/$networkId" params={{ networkId: String(network?.id) }}>
								{networkIdentifier}
							</Link>
						)
					}
				/>
			) : (
				networkIdentifier
			)}
			<span className="my-auto text-center">
				{vehicleNumber ? (
					<>
						{journey.vehicle?.designation ? (
							<Tooltip>
								<TooltipTrigger render={vehicleLink} />
								<TooltipContent className="shadow-xl" side="top" sideOffset={2}>
									{journey.vehicle.designation}
								</TooltipContent>
							</Tooltip>
						) : (
							vehicleLink
						)}
						–{" "}
					</>
				) : null}
				{recordedAt}
			</span>
			<div className="flex items-center justify-end gap-1.5">
				{airConditioningInformation !== undefined && canReportAirConditioning && journey.vehicle?.airConditioning ? (
					<Dialog open={airConditioningReportOpen} onOpenChange={setAirConditioningReportOpen}>
						<CustomTooltip
							className={clsx("font-bold", airConditioningInformation.tooltipClasses)}
							content={m.marker_air_conditioning_report_hint({
								status: airConditioningInformation.tooltipText(),
							})}
							place="left"
						>
							<DialogTrigger
								render={
									<Button
										className="size-6 p-0 -mr-0.5"
										size="icon"
										title={airConditioningInformation.tooltipText()}
										variant="ghost"
									>
										<AirConditioningIcon status={journey.vehicle.airConditioning} />
									</Button>
								}
							/>
						</CustomTooltip>
						<DialogContent aria-describedby="air-conditioning-report-description">
							<DialogHeader>
								<DialogTitle>{m.marker_air_conditioning_report_title()}</DialogTitle>
								<DialogDescription id="air-conditioning-report-description" className="whitespace-pre-wrap">
									{journey.vehicle.airConditioning === "PRESENT"
										? m.marker_air_conditioning_report_current_functional()
										: m.marker_air_conditioning_report_current_broken()}
								</DialogDescription>
							</DialogHeader>
							<DialogFooter className="gap-2">
								<Button
									className={clsx(
										journey.vehicle.airConditioning === "PRESENT"
											? positiveReportButtonClasses
											: negativeReportButtonClasses,
									)}
									disabled={reportingAirConditioning}
									onClick={() =>
										onAirConditioningReport(
											journey.vehicle?.airConditioning === "PRESENT" ? "PRESENT" : "OUT_OF_SERVICE",
										)
									}
									variant="ghost"
								>
									{journey.vehicle.airConditioning === "PRESENT" ? (
										<>
											<AirConditioningIcon status="PRESENT" />
											{m.marker_air_conditioning_report_still_functional()}
										</>
									) : (
										<>
											<AirConditioningIcon status="OUT_OF_SERVICE" />
											{m.marker_air_conditioning_report_still_broken()}
										</>
									)}
								</Button>
								<Button
									className={clsx(
										journey.vehicle.airConditioning === "PRESENT"
											? negativeReportButtonClasses
											: positiveReportButtonClasses,
									)}
									disabled={reportingAirConditioning}
									onClick={() =>
										onAirConditioningReport(
											journey.vehicle?.airConditioning === "PRESENT" ? "OUT_OF_SERVICE" : "PRESENT",
										)
									}
									variant="ghost"
								>
									{journey.vehicle.airConditioning === "PRESENT" ? (
										<>
											<AirConditioningIcon status="OUT_OF_SERVICE" />
											{m.marker_air_conditioning_report_mark_broken()}
										</>
									) : (
										<>
											<AirConditioningIcon status="PRESENT" />
											{m.marker_air_conditioning_report_restored()}
										</>
									)}
								</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				) : airConditioningInformation !== undefined && journey.vehicle?.airConditioning ? (
					<CustomTooltip
						className={clsx("font-bold", airConditioningInformation.tooltipClasses)}
						content={airConditioningInformation.tooltipText()}
						place="left"
					>
						<AirConditioningIcon status={journey.vehicle.airConditioning} />
					</CustomTooltip>
				) : null}
				{occupancyInformation !== undefined && (
					<CustomTooltip
						className={clsx("font-bold", occupancyInformation.tooltipClasses)}
						content={occupancyInformation.tooltipText()}
						place="left"
					>
						<occupancyInformation.IconElement className={clsx("align-middle", occupancyInformation.iconClass)} />
					</CustomTooltip>
				)}
				<CustomTooltip
					className={clsx("font-bold", positionInformation.tooltipClasses)}
					content={positionInformation.tooltipText()}
					place="left"
				>
					<SatelliteDishIcon className="size-5" color={positionInformation.iconColor} />
				</CustomTooltip>
			</div>
		</div>
	);
}

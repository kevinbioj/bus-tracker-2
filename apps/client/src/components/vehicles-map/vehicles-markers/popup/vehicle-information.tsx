import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import dayjs from "dayjs";
import { HTTPError } from "ky";
import { ClockIcon, SatelliteDishIcon, TriangleAlertIcon, UsbIcon } from "lucide-react";
import { useSnackbar } from "notistack";
import { useMemo, useState } from "react";
import { match } from "ts-pattern";
import { useLocalStorage } from "usehooks-ts";

import { GetNetworkQuery } from "~/api/networks";
import type { DisposeableVehicleJourney } from "~/api/vehicle-journeys";
import { CreateVehicleReportMutation, GetLastVehicleReportQuery } from "~/api/vehicles";
import { CustomTooltip } from "~/components/custom-tooltip";
import { Button } from "~/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "~/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { InformationChip } from "~/components/vehicles-map/vehicles-markers/popup/information-chip";
import { InformationChipsRow } from "~/components/vehicles-map/vehicles-markers/popup/information-chips-row";
import { useDebouncedMemo } from "~/hooks/use-debounced-memo";
import { AirConditioningIcon, airConditioningIconDetails } from "~/icons/air-conditioning";
import { HighCrowdIcon } from "~/icons/crowd/high";
import { LowCrowdIcon } from "~/icons/crowd/low";
import { MediumCrowdIcon } from "~/icons/crowd/medium";
import { NoPassengersIcon } from "~/icons/crowd/no-passengers";
import { MeansOfTransportIcon } from "~/icons/means-of-transport";
import * as m from "~/paraglide/messages";

const positionIconDetails = {
	GPS: {
		chipClasses: "bg-green-700 dark:bg-green-600 text-white",
		label: m.marker_chip_position_gps,
		title: m.marker_position_gps,
	},
	ESTIMATED: {
		chipClasses: "bg-orange-700 dark:bg-orange-600 text-white",
		label: m.marker_chip_position_estimated,
		title: m.marker_position_estimated,
	},
	SCHEDULED: {
		chipClasses: "bg-red-700 dark:bg-red-600 text-white",
		label: m.marker_chip_position_scheduled,
		title: m.marker_position_scheduled,
	},
} as const;

const occupancyIconDetails = {
	LOW: {
		IconElement: LowCrowdIcon,
		chipClasses: "bg-green-700 dark:bg-green-600 text-white",
		label: m.marker_occupancy_low,
	},
	MEDIUM: {
		IconElement: MediumCrowdIcon,
		chipClasses: "bg-orange-700 dark:bg-orange-600 text-white",
		label: m.marker_occupancy_medium,
	},
	HIGH: {
		IconElement: HighCrowdIcon,
		chipClasses: "bg-red-700 dark:bg-red-600 text-white",
		label: m.marker_occupancy_high,
	},
	NO_PASSENGERS: {
		IconElement: NoPassengersIcon,
		chipClasses: "bg-red-700 dark:bg-red-600 text-white",
		label: m.marker_occupancy_no_passengers,
	},
} as const;

/** Puce masquée pour l'instant : le reste du dispositif — fenêtre, libellés, données — reste en place. */
const displayUsbPorts = false;

const usbPortsIconDetails = {
	present: {
		chipClasses: "bg-sky-700 dark:bg-sky-600 text-white",
		label: m.marker_usb_ports_present,
	},
	absent: {
		chipClasses: "bg-red-700 dark:bg-red-600 text-white",
		label: m.marker_usb_ports_absent,
	},
} as const;

const neutralChipClasses = "bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-100";

const positiveReportButtonClasses =
	"text-sky-600 dark:text-sky-400 hover:text-sky-600 dark:hover:text-sky-400 bg-sky-600/10 hover:bg-sky-600/20 dark:bg-sky-600/20 dark:hover:bg-sky-600/30 focus-visible:border-sky-600/40 focus-visible:ring-sky-600/20";

const negativeReportButtonClasses =
	"text-red-600 dark:text-red-400 hover:text-red-600 dark:hover:text-red-400 bg-red-600/10 hover:bg-red-600/20 dark:bg-red-600/20 dark:hover:bg-red-600/30 focus-visible:border-red-600/40 focus-visible:ring-red-600/20";

/** Fenêtre explicative ouverte depuis l'une des puces d'information. */
type InformationDialog = "air-conditioning-report" | "usb-ports" | "position";

/** Un type de position dans la fenêtre d'aide : sa puce en guise de titre, puis son explication. */
function PositionHelpEntry({
	className,
	description,
	details,
}: Readonly<{
	className?: string;
	description: string;
	details: (typeof positionIconDetails)[keyof typeof positionIconDetails];
}>) {
	return (
		<div className={clsx("flex flex-col items-start gap-1.5", className)}>
			<InformationChip
				className={clsx("w-fit", details.chipClasses)}
				icon={<SatelliteDishIcon className="size-full" />}
				label={details.title()}
				size="md"
			/>
			<p className="text-[0.9375rem]">{description}</p>
		</div>
	);
}

type VehicleInformationProps = {
	disableLinks?: boolean;
	journey: DisposeableVehicleJourney;
};

export function VehicleInformation({ disableLinks, journey }: Readonly<VehicleInformationProps>) {
	const [displayAbsoluteTime] = useLocalStorage("display-absolute-time", false);
	const [openedDialog, setOpenedDialog] = useState<InformationDialog | null>(null);
	const queryClient = useQueryClient();
	const snackbar = useSnackbar();

	const { data: network } = useQuery(GetNetworkQuery(journey.networkId, !journey.girouette));
	const { data: lastAirConditioningReport } = useQuery(
		GetLastVehicleReportQuery(journey.vehicle?.id, openedDialog === "air-conditioning-report"),
	);
	const { isPending: reportingAirConditioning, mutateAsync: reportAirConditioning } = useMutation(
		CreateVehicleReportMutation(journey.vehicle?.id ?? 0),
	);

	const recordedAt = useDebouncedMemo(
		() => {
			const recordedAtTime = dayjs(journey.position.recordedAt);
			if (displayAbsoluteTime) {
				return { label: recordedAtTime.format("HH:mm:ss"), title: undefined };
			}
			if (dayjs().isBefore(recordedAtTime)) {
				return { label: m.marker_chip_before_departure(), title: m.marker_before_departure() };
			}

			const seconds = dayjs().diff(recordedAtTime, "second");
			if (seconds < 60) {
				return {
					label: m.marker_chip_recorded_seconds({ count: seconds }),
					title: m.marker_recorded_ago_seconds({ count: seconds }),
				};
			}
			if (seconds < 3_600) {
				const minutes = Math.floor(seconds / 60);
				return {
					label: m.marker_chip_recorded_minutes({ count: minutes }),
					title: m.marker_recorded_ago_minutes({ count: minutes }),
				};
			}
			const hours = Math.floor(seconds / 3_600);
			return {
				label: m.marker_chip_recorded_hours({ count: hours }),
				title: m.marker_recorded_ago_hours({ count: hours }),
			};
		},
		3_000,
		[journey, displayAbsoluteTime],
	);

	const networkIdentifier = network?.logoHref ? (
		<Tooltip>
			<TooltipTrigger
				render={
					<picture className="min-w-8 max-w-28 w-fit">
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

	const vehicleChip = journey.vehicle ? (
		<InformationChip
			className={neutralChipClasses}
			icon={
				journey.vehicle.type ? <MeansOfTransportIcon className="size-full" type={journey.vehicle.type} /> : undefined
			}
			label={journey.vehicle.number}
			render={
				journey.vehicle.id && !disableLinks ? (
					<Link to="/data/vehicles/$vehicleId" params={{ vehicleId: String(journey.vehicle.id) }} />
				) : undefined
			}
		/>
	) : undefined;

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

	const airConditioningStatus = journey.vehicle?.airConditioning;
	const airConditioningInformation = airConditioningStatus
		? airConditioningIconDetails[airConditioningStatus]
		: undefined;
	const canReportAirConditioning =
		journey.vehicle?.id !== undefined &&
		(airConditioningStatus === "PRESENT" || airConditioningStatus === "OUT_OF_SERVICE");

	const usbPortsInformation =
		displayUsbPorts && journey.vehicle?.usbPorts !== undefined
			? usbPortsIconDetails[journey.vehicle.usbPorts ? "present" : "absent"]
			: undefined;

	const closeDialog = () => setOpenedDialog(null);

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
			closeDialog();
		}
	};

	const dialogContent = openedDialog
		? match(openedDialog)
				.with("air-conditioning-report", () => ({
					title: m.marker_air_conditioning_report_title(),
					description: (
						<>
							<p className="whitespace-pre-wrap">
								{airConditioningStatus === "PRESENT"
									? m.marker_air_conditioning_report_current_functional()
									: m.marker_air_conditioning_report_current_broken()}
							</p>
							{lastAirConditioningReport != null && (
								<p className="mt-2 text-xs">
									{m.marker_air_conditioning_report_last({
										status:
											lastAirConditioningReport.value === "PRESENT"
												? m.marker_air_conditioning_state_functional()
												: m.marker_air_conditioning_state_broken(),
										date: dayjs(lastAirConditioningReport.reportedAt).format("DD/MM"),
										time: dayjs(lastAirConditioningReport.reportedAt).format("HH:mm"),
									})}
								</p>
							)}
						</>
					),
					footer: (
						<DialogFooter className="gap-2">
							<Button
								className={clsx(
									airConditioningStatus === "PRESENT" ? positiveReportButtonClasses : negativeReportButtonClasses,
								)}
								disabled={reportingAirConditioning}
								onClick={() =>
									onAirConditioningReport(airConditioningStatus === "PRESENT" ? "PRESENT" : "OUT_OF_SERVICE")
								}
								variant="ghost"
							>
								{airConditioningStatus === "PRESENT" ? (
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
									airConditioningStatus === "PRESENT" ? negativeReportButtonClasses : positiveReportButtonClasses,
								)}
								disabled={reportingAirConditioning}
								onClick={() =>
									onAirConditioningReport(airConditioningStatus === "PRESENT" ? "OUT_OF_SERVICE" : "PRESENT")
								}
								variant="ghost"
							>
								{airConditioningStatus === "PRESENT" ? (
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
					),
				}))
				.with("usb-ports", () => ({
					title: m.marker_usb_ports_help_title(),
					description: <p className="whitespace-pre-wrap">{m.marker_usb_ports_help_description()}</p>,
					footer: undefined,
				}))
				.with("position", () => ({
					title: m.marker_position_help_title(),
					description: (
						<>
							<PositionHelpEntry details={positionIconDetails.GPS} description={m.marker_position_help_gps()} />
							<PositionHelpEntry
								className="mt-3"
								details={positionIconDetails.ESTIMATED}
								description={m.marker_position_help_estimated()}
							/>
							<PositionHelpEntry
								className="mt-3"
								details={positionIconDetails.SCHEDULED}
								description={m.marker_position_help_scheduled()}
							/>
							<div className="mt-3 flex gap-2 rounded-md border border-amber-600/40 bg-amber-500/10 p-2 text-[0.9375rem] text-amber-800 dark:border-amber-400/40 dark:text-amber-200">
								<TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
								<span>{m.marker_position_help_extrapolated_warning()}</span>
							</div>
						</>
					),
					footer: undefined,
				}))
				.exhaustive()
		: undefined;

	const informationChips = [
		airConditioningInformation !== undefined && airConditioningStatus !== undefined
			? {
					key: "air-conditioning",
					element: (
						<CustomTooltip
							className={clsx("font-bold", airConditioningInformation.chipClasses)}
							content={airConditioningInformation.label()}
							place="top"
						>
							<InformationChip
								className={airConditioningInformation.chipClasses}
								icon={<AirConditioningIcon className="size-full" status={airConditioningStatus} tone="on-color" />}
								onClick={canReportAirConditioning ? () => setOpenedDialog("air-conditioning-report") : undefined}
							/>
						</CustomTooltip>
					),
				}
			: undefined,
		usbPortsInformation !== undefined
			? {
					key: "usb-ports",
					element: (
						<InformationChip
							className={usbPortsInformation.chipClasses}
							icon={<UsbIcon className="size-full" />}
							label={usbPortsInformation.label()}
							onClick={() => setOpenedDialog("usb-ports")}
						/>
					),
				}
			: undefined,
		occupancyInformation !== undefined
			? {
					key: "occupancy",
					element: (
						<CustomTooltip
							className={clsx("font-bold", occupancyInformation.chipClasses)}
							content={occupancyInformation.label()}
							place="top"
						>
							<InformationChip
								className={occupancyInformation.chipClasses}
								icon={<occupancyInformation.IconElement className="size-full fill-current" />}
							/>
						</CustomTooltip>
					),
				}
			: undefined,
		{
			key: "position",
			element: (
				<InformationChip
					className={positionInformation.chipClasses}
					icon={<SatelliteDishIcon className="size-full" />}
					label={positionInformation.label()}
					onClick={() => setOpenedDialog("position")}
					title={positionInformation.title()}
				/>
			),
		},
		{
			key: "recorded-at",
			element: (
				<InformationChip
					className={neutralChipClasses}
					icon={<ClockIcon className="size-full" />}
					label={recordedAt.label}
					title={recordedAt.title}
				/>
			),
		},
	].filter((chip) => chip !== undefined);

	return (
		<>
			<InformationChipsRow
				chips={informationChips}
				leading={
					<>
						{network !== undefined && !disableLinks ? (
							<Button
								className="px-1 shrink-0"
								size="xs"
								variant="ghost"
								nativeButton={false}
								render={
									<Link title={m.map_filter_whole_network()} to="/" search={{ "network-id": network.id }}>
										{networkIdentifier}
									</Link>
								}
							/>
						) : (
							networkIdentifier
						)}
						{vehicleChip !== undefined &&
							(journey.vehicle?.designation ? (
								<Tooltip>
									<TooltipTrigger render={vehicleChip} />
									<TooltipContent className="shadow-xl" side="top" sideOffset={2}>
										{journey.vehicle.designation}
									</TooltipContent>
								</Tooltip>
							) : (
								vehicleChip
							))}
					</>
				}
			/>
			<Dialog open={openedDialog !== null} onOpenChange={(open) => !open && closeDialog()}>
				{/* Sur un écran court, l'aide sur les positions dépasse la hauteur disponible : le corps de la
				    fenêtre défile alors, en gardant son titre et son pied en place. */}
				<DialogContent
					aria-describedby="vehicle-information-dialog-description"
					className="max-h-[85dvh] grid-rows-[minmax(0,1fr)_auto]"
				>
					<DialogHeader className="min-h-0">
						<DialogTitle>{dialogContent?.title}</DialogTitle>
						<DialogDescription
							id="vehicle-information-dialog-description"
							className="min-h-0 overflow-y-auto overscroll-contain px-0.5 pb-1"
							render={<div />}
						>
							{dialogContent?.description}
						</DialogDescription>
					</DialogHeader>
					{dialogContent?.footer ?? (
						<DialogFooter>
							<DialogClose render={<Button type="button">{m.marker_help_close()}</Button>} />
						</DialogFooter>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}

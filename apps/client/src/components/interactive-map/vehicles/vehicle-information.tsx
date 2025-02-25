import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import dayjs from "dayjs";
import { SatelliteDishIcon } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useLocalStorage } from "usehooks-ts";

import { GetNetworkQuery } from "~/api/networks";
import type { DisposeableVehicleJourney } from "~/api/vehicle-journeys";
import { Button } from "~/components/ui/button";
import { CustomTooltip } from "~/components/ui/custom-tooltip";
import { useDebouncedMemo } from "~/hooks/use-debounced-memo";
import { UsersIcon } from "~/icons/users";
import { UsersSlashIcon } from "~/icons/users-slash";

const positionIconDetails = {
	GPS: {
		iconColor: "#38A169",
		tooltipClasses: "bg-green-600 dark:bg-green-700 text-white",
		tooltipText: "Position GPS",
	},
	ESTIMATED: {
		iconColor: "#DD6B20",
		tooltipClasses: "bg-orange-600 dark:bg-orange-700 text-white",
		tooltipText: "Position estimée",
	},
	SCHEDULED: {
		iconColor: "#E53E3E",
		tooltipClasses: "bg-red-600 dark:bg-red-700 text-white",
		tooltipText: "Position théorique",
	},
} as const;

const occupancyIconDetails = {
	LOW: {
		IconElement: UsersIcon,
		iconClass: "fill-green-600",
		tooltipClasses: "bg-green-600 dark:bg-green-700 text-white",
		tooltipText: "Charge faible",
	},
	MEDIUM: {
		IconElement: UsersIcon,
		iconClass: "fill-orange-600",
		tooltipClasses: "bg-orange-600 dark:bg-orange-700 text-white",
		tooltipText: "Charge moyenne",
	},
	HIGH: {
		IconElement: UsersIcon,
		iconClass: "fill-red-600",
		tooltipClasses: "bg-red-600 dark:bg-red-700 text-white",
		tooltipText: "Charge élevée",
	},
	NO_PASSENGERS: {
		IconElement: UsersSlashIcon,
		iconClass: "fill-red-600",
		tooltipClasses: "bg-red-600 dark:bg-red-700 text-white",
		tooltipText: "Sans voyageur",
	},
} as const;

type VehicleInformationProps = {
	journey: DisposeableVehicleJourney;
};

export function VehicleInformation({ journey }: Readonly<VehicleInformationProps>) {
	const [displayAbsoluteTime] = useLocalStorage("display-absolute-time", false);

	const { data: network } = useQuery(GetNetworkQuery(journey.networkId));

	const recordedAt = useDebouncedMemo(
		() =>
			displayAbsoluteTime
				? dayjs(journey.position.recordedAt).format("HH:mm:ss")
				: dayjs().to(journey.position.recordedAt, true),
		3_000,
		[journey],
	);

	const networkIdentifier = network?.logoHref ? (
		<picture className="min-w-12 w-fit">
			{network.darkModeLogoHref !== null ? (
				<source srcSet={network.darkModeLogoHref} media="(prefers-color-scheme: dark)" />
			) : null}
			<img className="h-5 object-contain m-auto" src={network.logoHref} alt="" />
		</picture>
	) : (
		<span>{network?.name}</span>
	);

	const vehicleNumber = journey.vehicle ? `n°${journey.vehicle.number}` : "N/A";

	const vehicleLink = journey.vehicle?.id ? (
		<Button asChild className="gap-0.5 py-0.5" size="xs" variant="ghost">
			<Link target="_blank" to={`/data/vehicles/${journey.vehicle.id}`}>
				{vehicleNumber}
			</Link>
		</Button>
	) : (
		<>{vehicleNumber} </>
	);

	const positionInformation = useMemo(() => {
		if (journey.position.type === "GPS") return positionIconDetails.GPS;
		return journey.calls?.some((call) => typeof call.expectedTime !== "undefined")
			? positionIconDetails.ESTIMATED
			: positionIconDetails.SCHEDULED;
	}, [journey]);

	const occupancyInformation = useMemo(() => {
		if (typeof journey.occupancy === "undefined") return;
		return occupancyIconDetails[journey.occupancy];
	}, [journey]);

	return (
		<div className="grid grid-cols-[3.5rem_1fr_3.5rem] px-2 py-1">
			{network?.hasVehiclesFeature ? (
				<Button asChild className="" size="xs" variant="ghost">
					<Link target="_blank" to={`/data/networks/${network?.id}`}>
						{networkIdentifier}
					</Link>
				</Button>
			) : (
				networkIdentifier
			)}
			<span className="my-auto text-center">
				{vehicleLink}– {recordedAt}
			</span>
			<div className="flex justify-end gap-2">
				{typeof occupancyInformation !== "undefined" && (
					<CustomTooltip
						className={clsx("font-bold", occupancyInformation.tooltipClasses)}
						content={occupancyInformation.tooltipText}
						place="left"
					>
						<occupancyInformation.IconElement className={clsx("size-5", occupancyInformation.iconClass)} />
					</CustomTooltip>
				)}
				<CustomTooltip
					className={clsx("font-bold", positionInformation.tooltipClasses)}
					content={positionInformation.tooltipText}
					place="left"
				>
					<SatelliteDishIcon className="size-5" color={positionInformation.iconColor} />
				</CustomTooltip>
			</div>
		</div>
	);
}

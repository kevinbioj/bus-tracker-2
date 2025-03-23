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
import { HighCrowdIcon } from "~/icons/crowd/high";
import { LowCrowdIcon } from "~/icons/crowd/low";
import { MediumCrowdIcon } from "~/icons/crowd/medium";
import { NoPassengersIcon } from "~/icons/crowd/no-passengers";

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
		IconElement: LowCrowdIcon,
		iconClass: "fill-green-600 size-4",
		tooltipClasses: "bg-green-600 dark:bg-green-700 text-white",
		tooltipText: "Faible affluence",
	},
	MEDIUM: {
		IconElement: MediumCrowdIcon,
		iconClass: "fill-orange-600 size-5",
		tooltipClasses: "bg-orange-600 dark:bg-orange-700 text-white",
		tooltipText: "Affluence moyenne",
	},
	HIGH: {
		IconElement: HighCrowdIcon,
		iconClass: "fill-red-600 size-5",
		tooltipClasses: "bg-red-600 dark:bg-red-700 text-white",
		tooltipText: "Forte affluence",
	},
	NO_PASSENGERS: {
		IconElement: NoPassengersIcon,
		iconClass: "fill-red-600 size-5",
		tooltipClasses: "bg-red-600 dark:bg-red-700 text-white",
		tooltipText: "Ne prend pas de voyageur",
	},
} as const;

type VehicleInformationProps = {
	journey: DisposeableVehicleJourney;
};

export function VehicleInformation({ journey }: Readonly<VehicleInformationProps>) {
	const [displayAbsoluteTime] = useLocalStorage("display-absolute-time", false);

	const { data: network } = useQuery(GetNetworkQuery(journey.networkId));

	const recordedAt = useDebouncedMemo(
		() => {
			if (displayAbsoluteTime) return dayjs(journey.position.recordedAt).format("HH:mm:ss");
			if (dayjs().isBefore(journey.position.recordedAt)) return "avant-départ";

			const duration = dayjs.duration(-dayjs().diff(journey.position.recordedAt));
			if (Math.abs(duration.asSeconds()) < 10) return "à l'instant";
			return duration.humanize(true);
		},
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

	const vehicleNumber = journey.vehicle ? `n°${journey.vehicle.number}` : undefined;

	const vehicleLink = journey.vehicle?.id ? (
		<Button asChild className="gap-0.5 py-0.5" size="xs" variant="ghost">
			<Link to={`/data/vehicles/${journey.vehicle.id}`}>{vehicleNumber}</Link>
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
					<Link to={`/data/networks/${network?.id}`}>{networkIdentifier}</Link>
				</Button>
			) : (
				networkIdentifier
			)}
			<span className="my-auto text-center">
				{vehicleNumber ? <>{vehicleLink}– </> : <></>}
				{recordedAt}
			</span>
			<div className="flex items-center justify-end gap-2">
				{typeof occupancyInformation !== "undefined" && (
					<CustomTooltip
						className={clsx("font-bold", occupancyInformation.tooltipClasses)}
						content={occupancyInformation.tooltipText}
						place="left"
					>
						<occupancyInformation.IconElement className={clsx("align-middle", occupancyInformation.iconClass)} />
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

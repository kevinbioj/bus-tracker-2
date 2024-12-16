import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import dayjs from "dayjs";
import { SatelliteDishIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { useLocalStorage } from "usehooks-ts";

import { GetNetworkQuery } from "~/api/networks";
import type { DisposeableVehicleJourney } from "~/api/vehicle-journeys";
import { Button } from "~/components/ui/button";
import { Tooltip } from "~/components/ui/tooltip";
import { useDebouncedMemo } from "~/hooks/use-debounced-memo";

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
				: dayjs().to(journey.position.recordedAt),
		3_000,
		[journey],
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

	const positionInformation =
		journey.position.type === "GPS"
			? positionIconDetails.GPS
			: journey.calls?.some((call) => typeof call.expectedTime !== "undefined")
				? positionIconDetails.ESTIMATED
				: positionIconDetails.SCHEDULED;

	return (
		<div className="grid grid-cols-[3.5rem_1fr_3.5rem] gap-2 px-2 py-1">
			<Button asChild className="w-fit" size="xs" variant="ghost">
				<Link target="_blank" to={`/data/networks/${network?.id}`}>
					{network?.logoHref ? (
						<picture>
							{network.darkModeLogoHref !== null ? (
								<source srcSet={network.darkModeLogoHref} media="(prefers-color-scheme: dark)" />
							) : null}
							<img className="h-5 object-contain my-auto" src={network.logoHref} alt="" />
						</picture>
					) : (
						<span>{network?.name}</span>
					)}
				</Link>
			</Button>
			<span className="my-auto text-center">
				{vehicleLink}– {recordedAt}
			</span>
			<div className="flex justify-end">
				<Tooltip
					className={clsx("font-bold", positionInformation.tooltipClasses)}
					content={positionInformation.tooltipText}
					place="left"
				>
					<SatelliteDishIcon className="h-5 w-5" color={positionInformation.iconColor} size={20} />
				</Tooltip>
			</div>
		</div>
	);
}

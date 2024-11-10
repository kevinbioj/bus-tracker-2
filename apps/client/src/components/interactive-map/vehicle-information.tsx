import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { LocateFixedIcon } from "lucide-react";
import { match } from "ts-pattern";
import { useLocalStorage } from "usehooks-ts";

import { GetNetworkQuery } from "~/api/networks";
import type { DisposeableVehicleJourney } from "~/api/vehicle-journeys";
import { useDebouncedMemo } from "~/hooks/use-debounced-memo";

type VehicleInformationProps = {
	journey: DisposeableVehicleJourney;
};

export function VehicleInformation({ journey }: VehicleInformationProps) {
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

	return (
		<div
			className="grid grid-cols-[3rem_1fr_3rem] gap-2 px-2 py-1"
			style={{
				backgroundColor: network?.color ?? undefined,
				color: network?.textColor ?? undefined,
			}}
		>
			{network?.logoHref ? (
				<img className="h-4 my-auto" src={network.logoHref} alt={network.name} />
			) : (
				<span>{network?.name}</span>
			)}
			<span className="text-center">
				{journey.vehicle ? `n°${journey.vehicle.number}` : "N/A"} – {recordedAt}
			</span>
			<LocateFixedIcon
				className="h-5 w-5 ml-auto"
				color={match(journey.position.type)
					.with("GPS", () => "#00AA00")
					.with("COMPUTED", () => {
						const isRealtime = journey.calls?.some((call) => typeof call.expectedTime !== "undefined");
						return isRealtime ? "#FF6600" : "#DD0000";
					})
					.exhaustive()}
				size={20}
			/>
		</div>
	);
}

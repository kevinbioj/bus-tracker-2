import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { GetJourneyGirouetteQuery } from "~/api/girouettes";
import type { DisposeableVehicleJourney } from "~/api/vehicle-journeys";
import { Girouette } from "~/components/interactive-map/girouette";
import { useLine } from "~/hooks/use-line";

type VehicleGirouetteProps = {
	journey: DisposeableVehicleJourney;
	visible: boolean;
	width: number;
	updateWidth: (width: number) => void;
};

export function VehicleGirouette({ journey, visible, width, updateWidth }: VehicleGirouetteProps) {
	const line = useLine(journey.networkId, journey.lineId);
	const { data: girouette } = useQuery(GetJourneyGirouetteQuery(journey, visible));

	const destination = journey.destination ?? journey.calls?.at(-1)?.stopName ?? "Destination inconnue";

	useEffect(() => {
		if (typeof girouette?.data.width !== "undefined") {
			updateWidth(girouette.data.width);
		}
	}, [girouette, updateWidth]);

	return (
		<div className="border-[1px] border-neutral-800">
			{girouette ? (
				<Girouette ledColor="WHITE" width={width} {...girouette.data} />
			) : (
				<Girouette
					ledColor="WHITE"
					routeNumber={
						typeof line !== "undefined"
							? {
									backgroundColor: line.color ?? undefined,
									textColor: line.textColor ?? undefined,
									outlineColor:
										line.textColor !== null ? (line.textColor === "#FFFFFF" ? "#000000" : "#FFFFFF") : undefined,
									font: line.number.length <= 3 ? "1508SUPX" : "1407SUPX",
									scroll: line.number.length >= "KKKKK".length,
									spacing: line.number.length >= 4 ? 0 : 1,
									text: line.number ?? "",
								}
							: undefined
					}
					pages={[
						{
							font:
								destination.length <= "KKKKKKKKKKKKKKKKK".length
									? "1508SUPX"
									: destination.length <= "FFFFFFFFFFFFFFFFFFFF".length
										? "1507SUPX"
										: "1407SUPX",
							scroll: destination.length >= "FFFFFFFFFFFFFFFFFFFFFFF".length,
							text: destination,
						},
					]}
					width={width}
				/>
			)}
		</div>
	);
}

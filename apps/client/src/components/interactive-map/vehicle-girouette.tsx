import { useQuery } from "@tanstack/react-query";
import { useScreen } from "usehooks-ts";

import { GetJourneyGirouetteQuery } from "~/api/girouettes";
import type { DisposeableVehicleJourney } from "~/api/vehicle-journeys";
import { Girouette } from "~/components/interactive-map/girouette";
import { useLine } from "~/hooks/use-line";

type VehicleGirouetteProps = {
	journey: DisposeableVehicleJourney;
};

export function VehicleGirouette({ journey }: VehicleGirouetteProps) {
	const line = useLine(journey.networkId, journey.lineId);
	const { data: girouette } = useQuery(GetJourneyGirouetteQuery(journey));

	const { width } = useScreen();
	const girouetteWidth = Math.min(width - 50, 384);

	const destination = journey.destination ?? journey.calls?.at(-1)?.stopName ?? "Destination inconnue";

	return (
		<div className="border-[1px] border-neutral-800">
			{girouette?.at(0) ? (
				<Girouette ledColor="WHITE" width={girouetteWidth} {...girouette.at(0)!.data} />
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
									font: line.number.length <= 3 ? "1508SUPX" : line.number.length === 4 ? "1507SUPX" : "1407SUPX",
									scroll: line.number.length >= "KKKK".length,
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
					width={girouetteWidth}
				/>
			)}
		</div>
	);
}

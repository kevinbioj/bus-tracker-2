import { useQuery } from "@tanstack/react-query";
import { useScreen } from "usehooks-ts";

import { GetJourneyGirouetteQuery } from "~/api/girouettes";
import type { DisposeableVehicleJourney } from "~/api/vehicle-journeys";
import { Girouette } from "~/components/interactive-map/girouette";

type VehicleGirouetteProps = {
	journey: DisposeableVehicleJourney;
};

export function VehicleGirouette({ journey }: VehicleGirouetteProps) {
	const { width } = useScreen();
	const { data: girouette } = useQuery(GetJourneyGirouetteQuery(journey));
	const girouetteWidth = Math.min(width - 50, 384);
	const destination = journey.destination ?? journey.calls?.at(-1)?.stopName ?? "Destination inconnue";

	return girouette?.at(0) ? (
		<Girouette ledColor="WHITE" width={girouetteWidth} {...girouette.at(0)!.data} />
	) : (
		<Girouette
			ledColor="WHITE"
			routeNumber={
				typeof journey.line !== "undefined"
					? {
							backgroundColor: journey.line.color ? `#${journey.line.color}` : undefined,
							textColor: journey.line.textColor ? `#${journey.line.textColor}` : undefined,
							outlineColor:
								journey.line.textColor === "FFFFFF"
									? "#000000"
									: journey.line.textColor === "000000"
										? "#FFFFFF"
										: undefined,
							font:
								journey.line.number.length <= 3
									? "1508SUPX"
									: journey.line.number.length === 4
										? "1507SUPX"
										: "1407SUPX",
							spacing: journey.line.number.length < 3 ? 2 : 1,
							text: journey.line.number ?? "",
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
					text: destination,
				},
			]}
			width={girouetteWidth}
		/>
	);
}

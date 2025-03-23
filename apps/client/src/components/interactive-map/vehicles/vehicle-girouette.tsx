import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { match } from "ts-pattern";

import { GetJourneyGirouetteQuery } from "~/api/girouettes";
import type { DisposeableVehicleJourney } from "~/api/vehicle-journeys";
import { Girouette } from "~/components/interactive-map/vehicles/girouette";
import { useLine } from "~/hooks/use-line";

const guessFont = (text: string) => {
	if (text.length <= "KKKKKKKKKKKKKKKKK".length) return "1508SUPX";
	if (text.length <= "FFFFFFFFFFFFFFFFFFFF".length) return "1507SUPX";
	return "1407SUPX";
};

const shouldScroll = (text: string) => text.length >= "FFFFFFFFFFFFFFFFFFFFFFF".length;

type VehicleGirouetteProps = {
	journey: DisposeableVehicleJourney;
	visible: boolean;
	width: number;
	updateWidth: (width: number) => void;
};

export function VehicleGirouette({ journey, visible, width, updateWidth }: Readonly<VehicleGirouetteProps>) {
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
									outlineColor: match(line.textColor)
										.with("#000000", () => "#FFFFFF")
										.with("#FFFFFF", () => "#000000")
										.otherwise(() => undefined),
									font: line.number.length <= 3 ? "1508SUPX" : "1407SUPX",
									scroll: line.number.length >= "KKKKK".length,
									spacing: line.number.length >= 4 ? 0 : 1,
									text: line.number ?? "",
								}
							: undefined
					}
					pages={[
						{
							font: guessFont(destination),
							scroll: shouldScroll(destination),
							text: destination,
						},
					]}
					width={width}
				/>
			)}
		</div>
	);
}

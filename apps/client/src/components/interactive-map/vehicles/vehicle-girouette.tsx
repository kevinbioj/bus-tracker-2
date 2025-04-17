import { match, P } from "ts-pattern";

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
	width: number;
};

export function VehicleGirouette({ journey, width }: Readonly<VehicleGirouetteProps>) {
	const girouette = journey.girouette;

	const line = useLine(girouette ? undefined : journey.networkId, journey.lineId);
	const destination = journey.destination ?? journey.calls?.at(-1)?.stopName ?? "Destination inconnue";

	return (
		<div className="border-[1px] border-neutral-800">
			{girouette ? (
				<Girouette ledColor="WHITE" width={width} {...girouette} />
			) : (
				<Girouette
					ledColor="WHITE"
					routeNumber={
						typeof line !== "undefined"
							? {
									backgroundColor: line.color ?? undefined,
									textColor: line.textColor ?? undefined,
									outlineColor: match([line.textColor, line.color])
										.with(["#FFFFFF", P.string], () => "#000000")
										.with([null, null], () => undefined)
										.otherwise(() => "#FFFFFF"),
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

import { useScreen } from "usehooks-ts";

import type { DisposeableVehicleJourney } from "~/api/vehicle-journeys";
import { VehicleGirouette } from "~/components/interactive-map/vehicle-girouette";
import { VehicleInformation } from "~/components/interactive-map/vehicle-information";
import { VehicleNextStops } from "~/components/interactive-map/vehicle-next-stops";

type VehicleDetailsProps = {
	journey: DisposeableVehicleJourney;
};

export function VehicleMarkerPopup({ journey }: VehicleDetailsProps) {
	const { width } = useScreen();

	const girouetteWidth = Math.min(width - 50, 384);

	return (
		<div style={{ width: girouetteWidth + 2 }}>
			<VehicleGirouette journey={journey} width={girouetteWidth} />
			<VehicleInformation journey={journey} />
			{typeof journey.calls !== "undefined" ? <VehicleNextStops calls={journey.calls} tooltipId={journey.id} /> : null}
		</div>
	);
}

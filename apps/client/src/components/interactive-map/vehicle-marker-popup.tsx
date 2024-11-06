import type { DisposeableVehicleJourney } from "~/api/vehicle-journeys";
import { VehicleGirouette } from "~/components/interactive-map/vehicle-girouette";
import { VehicleInformation } from "~/components/interactive-map/vehicle-information";
import { VehicleNextStops } from "~/components/interactive-map/vehicle-next-stops";

type VehicleDetailsProps = {
	journey: DisposeableVehicleJourney;
};

export function VehicleMarkerPopup({ journey }: VehicleDetailsProps) {
	return (
		<div className="w-min">
			<VehicleGirouette journey={journey} />
			<VehicleInformation journey={journey} />
			{typeof journey.calls !== "undefined" ? <VehicleNextStops calls={journey.calls} tooltipId={journey.id} /> : null}
		</div>
	);
}

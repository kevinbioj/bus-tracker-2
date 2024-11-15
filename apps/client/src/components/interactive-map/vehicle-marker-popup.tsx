import { useQuery } from "@tanstack/react-query";
import { Loader2Icon, LoaderCircleIcon, LoaderIcon } from "lucide-react";
import { useRef } from "react";
import { useScreen } from "usehooks-ts";

import { GetVehicleJourneyQuery } from "~/api/vehicle-journeys";
import { VehicleGirouette } from "~/components/interactive-map/vehicle-girouette";
import { VehicleInformation } from "~/components/interactive-map/vehicle-information";
import { VehicleNextStops } from "~/components/interactive-map/vehicle-next-stops";
import { useDomVisibility } from "~/hooks/use-dom-visibility";

type VehicleDetailsProps = {
	journeyId: string;
};

export function VehicleMarkerPopup({ journeyId }: VehicleDetailsProps) {
	const popupRef = useRef(null);
	const isPopupVisible = useDomVisibility(popupRef);

	const { width } = useScreen();

	const { data: journey } = useQuery(GetVehicleJourneyQuery(journeyId, isPopupVisible));

	const popupWidth = Math.min(width - 50, 384);

	return (
		<div ref={popupRef} style={{ width: popupWidth + 2 }}>
			{typeof journey !== "undefined" ? (
				<>
					<VehicleGirouette journey={journey} visible={isPopupVisible} width={popupWidth} />
					<VehicleInformation journey={journey} />
					{typeof journey.calls !== "undefined" ? (
						<VehicleNextStops calls={journey.calls} tooltipId={journey.id} />
					) : null}
				</>
			) : (
				<LoaderCircleIcon className="animate-spin m-auto p-1" size={64} />
			)}
		</div>
	);
}

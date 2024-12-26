import { useQuery } from "@tanstack/react-query";
import type { LatLngExpression } from "leaflet";
import { LoaderCircleIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useScreen } from "usehooks-ts";

import { GetVehicleJourneyQuery } from "~/api/vehicle-journeys";
import { VehicleGirouette } from "~/components/interactive-map/vehicle-girouette";
import { VehicleInformation } from "~/components/interactive-map/vehicle-information";
import { VehicleNextStops } from "~/components/interactive-map/vehicle-next-stops";
import { useDomVisibility } from "~/hooks/use-dom-visibility";

type VehicleDetailsProps = {
	journeyId: string;
	position: LatLngExpression;
	updatePopup: () => void;
};

export function VehicleMarkerPopup({ journeyId, position, updatePopup }: Readonly<VehicleDetailsProps>) {
	const popupRef = useRef(null);
	const isPopupVisible = useDomVisibility(popupRef);

	const { width } = useScreen();
	const [popupWidth, setPopupWidth] = useState(Math.min(width - 50, 384));

	const { data: journey, refetch } = useQuery(GetVehicleJourneyQuery(journeyId, isPopupVisible));

	// biome-ignore lint/correctness/useExhaustiveDependencies: we need to update on popupWidth changes
	useEffect(() => {
		updatePopup();
	}, [popupWidth, updatePopup]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: we need to update on position changes
	useEffect(() => {
		refetch();
	}, [position]);

	return (
		<div ref={popupRef} style={{ width: popupWidth + 2 }}>
			{typeof journey !== "undefined" ? (
				<>
					<VehicleGirouette journey={journey} visible={isPopupVisible} width={popupWidth} updateWidth={setPopupWidth} />
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

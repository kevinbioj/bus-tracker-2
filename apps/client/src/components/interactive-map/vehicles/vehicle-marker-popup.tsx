import { useQuery } from "@tanstack/react-query";
import type { LatLngExpression } from "leaflet";
import { LoaderCircleIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { useScreen } from "usehooks-ts";

import { GetVehicleJourneyQuery } from "~/api/vehicle-journeys";
import { VehicleGirouette } from "~/components/interactive-map/vehicles/vehicle-girouette";
import { VehicleInformation } from "~/components/interactive-map/vehicles/vehicle-information";
import { VehicleNextStops } from "~/components/interactive-map/vehicles/vehicle-next-stops";
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

	const { data: journey, isError, refetch } = useQuery(GetVehicleJourneyQuery(journeyId, isPopupVisible, true));
	const popupWidth = journey?.girouette?.width ?? Math.min(width - 50, 384);

	useEffect(() => {
		updatePopup();
	}, [journey?.girouette?.width, updatePopup]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: we need to update on position changes
	useEffect(() => {
		if (isPopupVisible) {
			refetch();
		}
	}, [position]);

	return (
		<div ref={popupRef} style={{ width: popupWidth + 2 }}>
			{isError ? (
				<p className="px-3 text-balance text-center">
					<span className="font-bold text-lg">☠️ Entrée introuvable</span>
					<br />
					<span className="text-muted-foreground">
						Cette entrée n'est plus d'actualité, elle devrait disparaitre au prochain rafraichissement de la carte.
					</span>
				</p>
			) : typeof journey !== "undefined" ? (
				<>
					<VehicleGirouette journey={journey} width={popupWidth} />
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

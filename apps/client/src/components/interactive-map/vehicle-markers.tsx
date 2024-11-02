import { useQuery } from "@tanstack/react-query";

import { VehicleJourneysQuery } from "~/api/vehicle-journeys";
import { VehicleMarker } from "~/components/interactive-map/vehicle-marker.jsx";

type VehicleMarkersProps = {
	activeMarker?: string;
	setActiveMarker: (marker: string) => void;
};

export function VehicleMarkers({ activeMarker, setActiveMarker }: VehicleMarkersProps) {
	const { data } = useQuery(VehicleJourneysQuery);
	if (typeof data === "undefined") return null;

	return data.journeys.map((journey) => (
		<VehicleMarker key={journey.id} activeMarker={activeMarker} setActiveMarker={setActiveMarker} journey={journey} />
	));
}

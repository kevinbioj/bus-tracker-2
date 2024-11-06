import { useQuery } from "@tanstack/react-query";

import { VehicleJourneysQuery } from "~/api/vehicle-journeys";
import { VehicleMarker } from "~/components/interactive-map/vehicle-marker.jsx";
import { useMapBounds } from "~/hooks/use-map-bounds";

type VehicleMarkersProps = {
	activeMarker?: string;
	setActiveMarker: (marker: string) => void;
};

export function VehicleMarkers({ activeMarker, setActiveMarker }: VehicleMarkersProps) {
	const bounds = useMapBounds();
	const { data } = useQuery(VehicleJourneysQuery(bounds));

	return data?.journeys.map((journey) => (
		<VehicleMarker key={journey.id} activeMarker={activeMarker} setActiveMarker={setActiveMarker} journey={journey} />
	));
}

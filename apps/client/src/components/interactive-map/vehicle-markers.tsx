import { useQuery } from "@tanstack/react-query";

import { GetVehicleJourneyMarkersQuery } from "~/api/vehicle-journeys";
import { VehicleMarker } from "~/components/interactive-map/vehicle-marker.jsx";
import { useMapBounds } from "~/hooks/use-map-bounds";

type VehicleMarkersProps = {
	activeMarker?: string;
	setActiveMarker: (marker: string) => void;
};

export function VehicleMarkers({ activeMarker, setActiveMarker }: VehicleMarkersProps) {
	const bounds = useMapBounds();

	const { data } = useQuery(GetVehicleJourneyMarkersQuery(bounds));

	return data?.items.map((marker) => (
		<VehicleMarker key={marker.id} activeMarker={activeMarker} setActiveMarker={setActiveMarker} marker={marker} />
	));
}

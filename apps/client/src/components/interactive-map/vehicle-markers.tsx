import { useQuery } from "@tanstack/react-query";
import { useLocalStorage } from "usehooks-ts";

import { VehicleJourneysQuery } from "~/api/vehicle-journeys";
import { VehicleMarker } from "~/components/interactive-map/vehicle-marker.jsx";
import { useMapBounds } from "~/hooks/use-map-bounds";

type VehicleMarkersProps = {
	activeMarker?: string;
	setActiveMarker: (marker: string) => void;
};

export function VehicleMarkers({ activeMarker, setActiveMarker }: VehicleMarkersProps) {
	const [displayNextCalls] = useLocalStorage("display-next-calls", true);

	const bounds = useMapBounds();
	const { data } = useQuery(VehicleJourneysQuery(bounds, displayNextCalls));

	return data?.journeys.map((journey) => (
		<VehicleMarker key={journey.id} activeMarker={activeMarker} setActiveMarker={setActiveMarker} journey={journey} />
	));
}

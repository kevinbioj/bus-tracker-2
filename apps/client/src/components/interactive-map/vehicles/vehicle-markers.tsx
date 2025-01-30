import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useMap } from "react-leaflet";

import { GetVehicleJourneyMarkersQuery } from "~/api/vehicle-journeys";
import { useActiveMarker } from "~/components/interactive-map/active-marker/active-marker";
import { VehicleMarker } from "~/components/interactive-map/vehicles/vehicle-marker";
import { useMapBounds } from "~/hooks/use-map-bounds";

export function VehicleMarkers() {
	const map = useMap();
	const bounds = useMapBounds();

	const { activeMarker, setActiveMarker } = useActiveMarker();

	const { data } = useQuery(GetVehicleJourneyMarkersQuery(bounds, activeMarker));

	useEffect(() => {
		if (typeof map === "undefined") return;

		const onClick = () => {
			setActiveMarker(undefined);
			map.closePopup();
		};

		const onPopupClose = () => setActiveMarker(undefined);

		map.addEventListener("click", onClick);
		map.addEventListener("popupclose", onPopupClose);
		return () => {
			map.removeEventListener("popupclose", onPopupClose);
			map.removeEventListener("click", onClick);
		};
	});

	return data?.items.map((marker) => (
		<VehicleMarker key={marker.id} activeMarker={activeMarker} setActiveMarker={setActiveMarker} marker={marker} />
	));
}

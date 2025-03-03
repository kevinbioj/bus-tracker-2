import { useQuery } from "@tanstack/react-query";
import { LucideLoader2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useMap } from "react-leaflet";

import { GetVehicleJourneyMarkersQuery } from "~/api/vehicle-journeys";
import { useActiveMarker } from "~/components/interactive-map/active-marker/active-marker";
import { VehicleMarker } from "~/components/interactive-map/vehicles/vehicle-marker";
import { useMapBounds } from "~/hooks/use-map-bounds";

export function VehicleMarkers() {
	const map = useMap();
	const bounds = useMapBounds();

	const { activeMarker, setActiveMarker } = useActiveMarker();

	const { data, isFetching } = useQuery(GetVehicleJourneyMarkersQuery(bounds, activeMarker));

	const loader = useMemo(
		() => (
			<div
				className="absolute data-[visible=true]:animate-in data-[visible=true]:fade-in border top-2 right-2 bg-background text-foreground p-1 rounded-md z-[1001] data-[visible=false]:hidden"
				data-visible={isFetching}
			>
				<LucideLoader2 className="animate-spin size-6" strokeWidth={3} />
			</div>
		),
		[isFetching],
	);

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

	return (
		<>
			{loader}
			{data?.items.map((marker) => (
				<VehicleMarker key={marker.id} activeMarker={activeMarker} setActiveMarker={setActiveMarker} marker={marker} />
			))}
		</>
	);
}

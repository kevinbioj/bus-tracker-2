import type { LatLngExpression, Map as MapInstance } from "leaflet";
import { useCallback, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import { useLocalStorage } from "usehooks-ts";

import { Geolocate } from "~/components/interactive-map/geolocate";
import { LocationSaver } from "~/components/interactive-map/location-saver";
import { VehicleMarkers } from "~/components/interactive-map/vehicle-markers";

type InteractiveMapProps = {
	className?: string;
	defaultCenter: LatLngExpression;
	defaultZoom: number;
};

export function InteractiveMap({ className, defaultCenter, defaultZoom }: InteractiveMapProps) {
	const [activeMarker, setActiveMarker] = useState<string>();
	const [lastLocation] = useLocalStorage<[number, number, number] | null>("last-location", null);

	const mapRef = useCallback((map: MapInstance | null) => {
		if (map === null) return;

		map.addEventListener("click", () => {
			setActiveMarker(undefined);
			map.closePopup();
		});

		map.addEventListener("popupclose", () => {
			setActiveMarker(undefined);
		});
	}, []);

	return (
		<MapContainer
			center={lastLocation ? [lastLocation[0], lastLocation[1]] : defaultCenter}
			className={className}
			id="interactive-map"
			ref={mapRef}
			zoom={lastLocation?.[2] ?? defaultZoom}
		>
			<TileLayer
				attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
				url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
			/>
			<LocationSaver />
			<VehicleMarkers activeMarker={activeMarker} setActiveMarker={setActiveMarker} />
			<Geolocate />
		</MapContainer>
	);
}

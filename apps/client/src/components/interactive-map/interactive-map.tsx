import { clsx } from "clsx";
import type { LatLngExpression, Map as MapInstance } from "leaflet";
import { useEffect, useRef } from "react";
import { MapContainer, ScaleControl, TileLayer } from "react-leaflet";
import { useLocalStorage } from "usehooks-ts";
import { ActiveMarkerProvider } from "~/components/interactive-map/active-marker/active-marker";

import { LocateControl } from "~/components/interactive-map/locate-control";
import { LocationSaver } from "~/components/interactive-map/location-saver";
import { OnlineControl } from "~/components/interactive-map/online/online-control";
import { VehicleMarkers } from "~/components/interactive-map/vehicles/vehicle-markers";

type InteractiveMapProps = {
	className?: string;
	defaultCenter: LatLngExpression;
	defaultZoom: number;
};

export function InteractiveMap({ className, defaultCenter, defaultZoom }: Readonly<InteractiveMapProps>) {
	const [lastLocation] = useLocalStorage<[number, number, number] | null>("last-location", null);
	const [bypassMinZoom] = useLocalStorage("bypass-min-zoom", false);

	const mapRef = useRef<MapInstance>(null);

	useEffect(() => {
		const map = mapRef.current;
		if (map === null) return;

		map.setMinZoom(bypassMinZoom ? 0 : 9);
	}, [bypassMinZoom]);

	return (
		<MapContainer
			center={lastLocation ? [lastLocation[0], lastLocation[1]] : defaultCenter}
			className={clsx("relative", className)}
			id="interactive-map"
			ref={mapRef}
			zoom={lastLocation?.[2] ?? defaultZoom}
			minZoom={bypassMinZoom ? undefined : 9}
		>
			<TileLayer
				attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
				url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
			/>
			<ActiveMarkerProvider>
				<OnlineControl />
				<VehicleMarkers />
			</ActiveMarkerProvider>
			<LocationSaver />
			<LocateControl />
			<ScaleControl />
		</MapContainer>
	);
}

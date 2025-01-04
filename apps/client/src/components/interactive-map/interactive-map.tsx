import "@maplibre/maplibre-gl-leaflet";

import type { LatLngExpression, Map as MapInstance } from "leaflet";
import * as L from "leaflet";
import { Suspense, useEffect, useRef, useState } from "react";
import { MapContainer } from "react-leaflet";
import { useLocalStorage } from "usehooks-ts";

import { LocateControl } from "~/components/interactive-map/locate-control";
import { LocationSaver } from "~/components/interactive-map/location-saver";
import { VehicleMarkers } from "~/components/interactive-map/vehicle-markers";

type InteractiveMapProps = {
	className?: string;
	defaultCenter: LatLngExpression;
	defaultZoom: number;
};

type MapElement = {
	target: MapInstance;
};

export function InteractiveMap({ className, defaultCenter, defaultZoom }: Readonly<InteractiveMapProps>) {
	const [activeMarker, setActiveMarker] = useState<string>();
	const [lastLocation] = useLocalStorage<[number, number, number] | null>("last-location", null);
	const [bypassMinZoom] = useLocalStorage("bypass-min-zoom", false);

	const mapRef = useRef<MapInstance>(null);

	useEffect(() => {
		const map = mapRef.current;
		if (map === null) return;

		map.setMinZoom(bypassMinZoom ? 0 : 9);
	}, [bypassMinZoom]);

	const whenMapReady = ({ target: map }: MapElement) => {
		map.addEventListener("click", () => {
			setActiveMarker(undefined);
			map.closePopup();
		});

		map.addEventListener("popupclose", () => {
			setActiveMarker(undefined);
		});

		L.maplibreGL({
			style: "https://tiles.openfreemap.org/styles/liberty",
		}).addTo(map);
	};

	return (
		<MapContainer
			center={lastLocation ? [lastLocation[0], lastLocation[1]] : defaultCenter}
			className={className}
			id="interactive-map"
			ref={mapRef}
			zoom={lastLocation?.[2] ?? defaultZoom}
			minZoom={bypassMinZoom ? undefined : 9}
			// @ts-expect-error react-leaflet typings are broken
			whenReady={whenMapReady}
		>
			<LocationSaver />
			<Suspense>
				<VehicleMarkers activeMarker={activeMarker} setActiveMarker={setActiveMarker} />
			</Suspense>
			<LocateControl />
		</MapContainer>
	);
}

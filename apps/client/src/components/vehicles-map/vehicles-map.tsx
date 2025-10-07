import maplibregl from "maplibre-gl";
import { useState, type ComponentPropsWithoutRef } from "react";

import "maplibre-gl/dist/maplibre-gl.css";

import { MapComponent } from "~/adapters/maplibre-gl/map";
import { OnlineControl } from "~/components/vehicles-map/online-vehicles/online-control";
import { DEFAULT_LOCATION, PositionSave } from "~/components/vehicles-map/position-save";
import { VehiclesMarkers } from "~/components/vehicles-map/vehicles-markers/vehicles-markers-layer";

type VehiclesMapProps = ComponentPropsWithoutRef<"div">;

export function VehiclesMap(props: VehiclesMapProps) {
	const [initialLocation] = useState(() => {
		const rawCurrentLocation = localStorage.getItem("current-location");
		if (rawCurrentLocation === null) return DEFAULT_LOCATION;

		try {
			return JSON.parse(rawCurrentLocation) as typeof DEFAULT_LOCATION;
		} catch {
			localStorage.removeItem("current-location");
			return DEFAULT_LOCATION;
		}
	});

	const onMap = (map: maplibregl.Map) => {
		const navigationControl = new maplibregl.NavigationControl();
		map.addControl(navigationControl, "top-left");

		const fullscreenControl = new maplibregl.FullscreenControl();
		map.addControl(fullscreenControl, "top-right");

		const geolocateControl = new maplibregl.GeolocateControl({
			trackUserLocation: true,
		});
		map.addControl(geolocateControl, "top-right");
	};

	return (
		<MapComponent
			containerProps={props}
			mapOptions={{
				center: initialLocation.position,
				// style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
				style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
				zoom: initialLocation.zoom,
			}}
			ref={onMap}
		>
			<PositionSave />
			<VehiclesMarkers />
			<OnlineControl />
		</MapComponent>
	);
}

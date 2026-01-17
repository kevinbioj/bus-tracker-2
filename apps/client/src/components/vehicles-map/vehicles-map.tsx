import maplibregl from "maplibre-gl";
import { type ComponentPropsWithoutRef, useState } from "react";
import { useLocation } from "react-router-dom";

import "maplibre-gl/dist/maplibre-gl.css";

import { MapComponent } from "~/adapters/maplibre-gl/map";
import { OnlineControl } from "~/components/vehicles-map/online-vehicles/online-control";
import { DEFAULT_LOCATION, PositionSave } from "~/components/vehicles-map/position-save";
import { VehiclesMarkers } from "~/components/vehicles-map/vehicles-markers/vehicles-markers-layer";

type VehiclesMapProps = ComponentPropsWithoutRef<"div">;

export function VehiclesMap(props: VehiclesMapProps) {
	const location = useLocation();

	const [initialLocation] = useState(() => {
		// location in url has priority over local storage location
		if (location.hash) {
			const [lng, lat, zoom] = location.hash.slice(1).split(",").map(Number);
			if (!Number.isNaN(lng) && !Number.isNaN(lat) && !Number.isNaN(zoom)) {
				return { position: { lng, lat }, zoom };
			}
		}

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
				style: "/map-styles/liberty-fr.json",
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

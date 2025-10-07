import type maplibregl from "maplibre-gl";

import { useMapLayer } from "~/adapters/maplibre-gl/use-map-layer";
import { useMapSource } from "~/adapters/maplibre-gl/use-map-source";
import { VehiclesMarkersData } from "~/components/vehicles-map/vehicles-markers/vehicles-markers-data";
import { VehiclesMarkersPopupRoot } from "~/components/vehicles-map/vehicles-markers/vehicles-markers-popup-root";

const initialData: maplibregl.SourceSpecification = {
	type: "geojson",
	data: { type: "FeatureCollection", features: [] },
};

const vehiclesLayer: maplibregl.AddLayerObject = {
	id: "vehicles",
	source: "vehicles",
	type: "circle",
	paint: {
		"circle-color": ["get", "fillColor"],
		"circle-radius": 6,
		"circle-stroke-color": ["get", "color"],
		"circle-stroke-width": 2.5,
	},
};

export function VehiclesMarkers() {
	const source = useMapSource<maplibregl.GeoJSONSource>("vehicles", initialData);
	const layer = useMapLayer(vehiclesLayer);

	if (layer === null || source === null) return null;
	return (
		<>
			<VehiclesMarkersData source={source} />
			<VehiclesMarkersPopupRoot layer={layer} />
		</>
	);
}

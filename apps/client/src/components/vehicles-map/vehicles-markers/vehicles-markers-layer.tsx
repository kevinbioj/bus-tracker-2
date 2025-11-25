import type maplibregl from "maplibre-gl";
import { useEffect } from "react";
import { useMap } from "~/adapters/maplibre-gl/map";

import { useMapLayer } from "~/adapters/maplibre-gl/use-map-layer";
import { useMapSource } from "~/adapters/maplibre-gl/use-map-source";
import { VehiclesMarkersData } from "~/components/vehicles-map/vehicles-markers/vehicles-markers-data";
import { VehiclesMarkersPopupRoot } from "~/components/vehicles-map/vehicles-markers/vehicles-markers-popup-root";

function createArrowIcon(color = "#000000") {
	const canvas = document.createElement("canvas");
	const size = 32;
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext("2d")!;
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.moveTo(size / 2, 0);
	ctx.lineTo(size, size);
	ctx.lineTo(0, size);
	ctx.closePath();
	ctx.fill();
	return canvas;
}

const initialData: maplibregl.SourceSpecification = {
	type: "geojson",
	data: { type: "FeatureCollection", features: [] },
};

const vehiclesLayerObject: maplibregl.AddLayerObject = {
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

const arrowsLayerObject: maplibregl.AddLayerObject = {
	id: "vehicles-arrows",
	source: "vehicles",
	type: "symbol",
	layout: {
		"icon-image": "arrow-icon",
		"icon-size": 0.5,
		"icon-allow-overlap": true,
		"icon-ignore-placement": true,
		"icon-rotation-alignment": "map",
		"icon-rotate": ["get", "bearing"],
		"icon-offset": [0, -20],
	},
	filter: ["!=", ["get", "bearing"], null],
	paint: {
		"icon-color": ["get", "fillColor"],
		"icon-opacity": ["interpolate", ["linear"], ["zoom"], 10, 0, 12, 1],
	},
};

export function VehiclesMarkers() {
	const map = useMap();
	const vehiclesSource = useMapSource<maplibregl.GeoJSONSource>("vehicles", initialData);
	const vehiclesLayer = useMapLayer(vehiclesLayerObject);
	useMapLayer(arrowsLayerObject, vehiclesLayerObject.id);

	useEffect(() => {
		let abort = false;
		const imageId = "arrow-icon";

		const onLoad = async () => {
			if (abort) return;
			const arrowIcon = createArrowIcon("black");
			const bitmap = await createImageBitmap(arrowIcon);
			map.addImage(imageId, bitmap, { sdf: true });
		};

		if (map.style._loaded) onLoad();
		else map.on("load", onLoad);

		return () => {
			abort = true;
			map.off("load", onLoad);
			if (map.style?._loaded && map.getImage(imageId) !== undefined) {
				map.removeImage(imageId);
			}
		};
	}, [map]);

	if (vehiclesLayer === null || vehiclesSource === null) return null;
	return (
		<>
			<VehiclesMarkersData source={vehiclesSource} />
			<VehiclesMarkersPopupRoot layer={vehiclesLayer} />
		</>
	);
}

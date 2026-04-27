import type maplibregl from "maplibre-gl";
import { useEffect } from "react";
import { useMap } from "~/adapters/maplibre-gl/map";

import { useMapLayer } from "~/adapters/maplibre-gl/use-map-layer";
import { useMapSource } from "~/adapters/maplibre-gl/use-map-source";
import { VehiclesMarkersData } from "~/components/vehicles-map/vehicles-markers/vehicles-markers-data";
import { VehiclesMarkersPopupRoot } from "~/components/vehicles-map/vehicles-markers/vehicles-markers-popup-root";

function createSquareIcon(color = "#000000") {
	const canvas = document.createElement("canvas");
	const size = 32;
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext("2d")!;
	ctx.fillStyle = color;
	ctx.beginPath();
	ctx.rect(0, 0, size, size);
	ctx.fill();
	return canvas;
}

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
	minzoom: 10,
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

const textLayerObject: maplibregl.AddLayerObject = {
	id: "vehicles-text",
	type: "symbol",
	source: "vehicles",
	minzoom: 13,
	filter: ["!=", ["get", "previewText"], null],
	layout: {
		"text-field": ["get", "previewText"],
		"icon-image": "square-icon",
		"icon-offset": [0, 1],
		"icon-text-fit": "both",
		"icon-text-fit-padding": [2.5, 3, 0.5, 3],
		"text-allow-overlap": false,
		"text-anchor": "top",
		"text-font": ["Parisine Bold"],
		"text-ignore-placement": false,
		"text-offset": [0, 1],
		"text-size": 12,
	},
	paint: {
		"icon-color": ["coalesce", ["get", "fillColor"], "#FFFFFF"],
		"icon-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0, 13.1, 0.7],
		"text-color": ["coalesce", ["get", "color"], "#000000"],
		"text-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0, 13.1, 1],
	},
};

type VehicleMarkersProps = {
	embeddedNetworkId?: number;
	lineId?: number;
};

export function VehiclesMarkers({ embeddedNetworkId, lineId }: VehicleMarkersProps) {
	const map = useMap();
	const vehiclesSource = useMapSource<maplibregl.GeoJSONSource>("vehicles", initialData);
	const vehiclesLayer = useMapLayer(vehiclesLayerObject);
	useMapLayer(arrowsLayerObject, vehiclesLayerObject.id);
	const textLayer = useMapLayer(textLayerObject);

	useEffect(() => {
		if (textLayer === null) return;
		if (lineId !== undefined) {
			map.setPaintProperty("vehicles-text", "icon-opacity", 0.7);
			map.setPaintProperty("vehicles-text", "text-opacity", 1);
			map.setLayerZoomRange("vehicles-text", 0, 24);
		} else {
			map.setPaintProperty("vehicles-text", "icon-opacity", ["interpolate", ["linear"], ["zoom"], 13, 0, 13.1, 0.7]);
			map.setPaintProperty("vehicles-text", "text-opacity", ["interpolate", ["linear"], ["zoom"], 13, 0, 13.1, 1]);
			map.setLayerZoomRange("vehicles-text", 13, 24);
		}
	}, [textLayer, lineId, map]);

	useEffect(() => {
		let abort = false;
		const arrowImageId = "arrow-icon";
		const squareImageId = "square-icon";

		const onLoad = async () => {
			if (abort) return;
			const arrowIcon = createArrowIcon("black");
			const arrowBitmap = await createImageBitmap(arrowIcon);
			map.addImage(arrowImageId, arrowBitmap, { sdf: true });

			const squareIcon = createSquareIcon("black");
			const squareBitmap = await createImageBitmap(squareIcon);
			map.addImage(squareImageId, squareBitmap, { sdf: true });
		};

		if (map.style._loaded) onLoad();
		else map.on("load", onLoad);

		return () => {
			abort = true;
			map.off("load", onLoad);
			if (map.style?._loaded && map.getImage(arrowImageId) !== undefined) {
				map.removeImage(arrowImageId);
				map.removeImage(squareImageId);
			}
		};
	}, [map]);

	if (vehiclesLayer === null || vehiclesSource === null) return null;
	return (
		<>
			<VehiclesMarkersData lineId={lineId} networkId={embeddedNetworkId} source={vehiclesSource} />
			<VehiclesMarkersPopupRoot embedMode={Boolean(embeddedNetworkId)} layer={vehiclesLayer} />
		</>
	);
}

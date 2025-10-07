import type maplibregl from "maplibre-gl";
import { useEffect, useState } from "react";

import { useMap } from "~/adapters/maplibre-gl/map";

export function useMapLayer(layerOptions: maplibregl.AddLayerObject) {
	const map = useMap();
	const [layer, setLayer] = useState<maplibregl.StyleLayer | null>(null);

	useEffect(() => {
		const onLoad = () => {
			if (!map.getLayer(layerOptions.id)) map.addLayer(layerOptions);
			setLayer(map.getLayer(layerOptions.id)! ?? null);
		};

		map.once("load", onLoad);
		return () => setLayer(null);
	}, [layerOptions, map]);

	return layer;
}

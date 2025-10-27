import type maplibregl from "maplibre-gl";
import { useEffect, useState } from "react";

import { useMap } from "~/adapters/maplibre-gl/map";

export function useMapLayer(layerOptions: maplibregl.AddLayerObject, beforeId?: string) {
	const map = useMap();
	const [layer, setLayer] = useState<maplibregl.StyleLayer | null>(null);

	useEffect(() => {
		let abort = false;

		const onLoad = () => {
			if (abort) return;

			map.addLayer(layerOptions, beforeId);
			setLayer(map.getLayer(layerOptions.id)!);
		};

		if (map.style._loaded) onLoad();
		else map.on("load", onLoad);

		return () => {
			abort = true;
			map.off("load", onLoad);

			if (map.style !== undefined && map.getLayer(layerOptions.id) !== undefined) {
				map.removeLayer(layerOptions.id);
			}

			setLayer(null);
		};
	}, [beforeId, layerOptions, map]);

	return layer;
}

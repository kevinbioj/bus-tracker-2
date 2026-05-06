import type maplibregl from "maplibre-gl";
import { useEffect, useState } from "react";

import { useMap } from "~/adapters/maplibre-gl/map";

export function useMapLayer(layerOptions: maplibregl.AddLayerObject, beforeId?: string) {
	const map = useMap();
	const [layer, setLayer] = useState<maplibregl.StyleLayer | null>(null);

	useEffect(() => {
		let abort = false;
		let retryTimeout: number | null = null;

		const sourceId =
			"source" in layerOptions && typeof layerOptions.source === "string" ? layerOptions.source : undefined;

		const scheduleRetry = () => {
			if (retryTimeout !== null) return;
			retryTimeout = window.setTimeout(() => {
				retryTimeout = null;
				addLayerWhenReady();
			}, 50);
		};

		const addLayerWhenReady = () => {
			if (abort) return;
			if (!map.style._loaded) return;

			const existingLayer = map.getLayer(layerOptions.id);
			if (existingLayer !== undefined) {
				setLayer(existingLayer);
				return;
			}

			if (sourceId !== undefined && map.getSource(sourceId) === undefined) {
				scheduleRetry();
				return;
			}

			if (beforeId !== undefined && map.getLayer(beforeId) === undefined) {
				scheduleRetry();
				return;
			}

			map.addLayer(layerOptions, beforeId);
			setLayer(map.getLayer(layerOptions.id)!);
		};

		if (map.style._loaded) addLayerWhenReady();
		else map.on("load", addLayerWhenReady);

		map.on("styledata", addLayerWhenReady);

		return () => {
			abort = true;
			map.off("load", addLayerWhenReady);
			map.off("styledata", addLayerWhenReady);

			if (retryTimeout !== null) {
				clearTimeout(retryTimeout);
			}

			if (map.style !== undefined && map.getLayer(layerOptions.id) !== undefined) {
				map.removeLayer(layerOptions.id);
			}

			setLayer(null);
		};
	}, [beforeId, layerOptions, map]);

	return layer;
}

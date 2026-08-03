import type { AddLayerObject, StyleLayer } from "maplibre-gl";
import { useEffect, useState } from "react";

import { useMap } from "~/adapters/maplibre-gl/map";
import { isStyleLoaded } from "~/adapters/maplibre-gl/style";

export function useMapLayer(layerOptions: AddLayerObject, beforeId?: string) {
	const map = useMap();
	const [layer, setLayer] = useState<StyleLayer | null>(null);

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
			if (!isStyleLoaded(map)) return;

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

		// losing the WebGL context destroys the style along with its layers, they are re-created
		// once the style has been reloaded ("styledata")
		const onContextLost = () => setLayer(null);

		addLayerWhenReady();

		map.on("load", addLayerWhenReady);
		map.on("styledata", addLayerWhenReady);
		map.on("webglcontextlost", onContextLost);

		return () => {
			abort = true;
			map.off("load", addLayerWhenReady);
			map.off("styledata", addLayerWhenReady);
			map.off("webglcontextlost", onContextLost);

			if (retryTimeout !== null) {
				clearTimeout(retryTimeout);
			}

			if (isStyleLoaded(map) && map.getLayer(layerOptions.id) !== undefined) {
				map.removeLayer(layerOptions.id);
			}

			setLayer(null);
		};
	}, [beforeId, layerOptions, map]);

	return layer;
}

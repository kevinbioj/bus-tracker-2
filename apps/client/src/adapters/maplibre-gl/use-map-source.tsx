import type { Source, SourceSpecification } from "maplibre-gl";
import { useCallback, useEffect, useState } from "react";

import { useMap } from "~/adapters/maplibre-gl/map";
import { isStyleLoaded } from "~/adapters/maplibre-gl/style";

export function useMapSource<T extends Source>(id: string, specification: SourceSpecification) {
	const map = useMap();
	const [source, setSource] = useState<T | null>(null);

	const removeSource = useCallback(() => {
		const style = map.getStyle();
		if (style === undefined || style.layers === undefined) return;

		for (const layer of style.layers) {
			if ("source" in layer && layer.source === id) {
				map.removeLayer(layer.id);
			}
		}

		if (map.getSource(id) !== undefined) {
			map.removeSource(id);
		}
	}, [id, map]);

	useEffect(() => {
		let abort = false;

		const addSourceWhenReady = () => {
			if (abort) return;
			if (!isStyleLoaded(map)) return;

			const existingSource = map.getSource<T>(id);
			if (existingSource !== undefined) {
				setSource(existingSource);
				return;
			}

			map.addSource(id, specification);
			setSource(map.getSource<T>(id)!);
		};

		// losing the WebGL context destroys the style along with its sources, they are re-created
		// once the style has been reloaded ("styledata")
		const onContextLost = () => setSource(null);

		addSourceWhenReady();

		map.on("load", addSourceWhenReady);
		map.on("styledata", addSourceWhenReady);
		map.on("webglcontextlost", onContextLost);

		return () => {
			abort = true;
			map.off("load", addSourceWhenReady);
			map.off("styledata", addSourceWhenReady);
			map.off("webglcontextlost", onContextLost);

			if (isStyleLoaded(map)) {
				removeSource();
			}

			setSource(null);
		};
	}, [id, map, removeSource, specification]);

	return source;
}

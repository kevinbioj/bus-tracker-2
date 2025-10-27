import type { SourceSpecification } from "maplibre-gl";
import { useCallback, useEffect, useState } from "react";

import { useMap } from "~/adapters/maplibre-gl/map";

export function useMapSource<T extends maplibregl.Source>(id: string, specification: SourceSpecification) {
	const map = useMap();
	const [source, setSource] = useState<T | null>(null);

	const removeSource = useCallback(() => {
		if (map.style === undefined) return;

		for (const layerId in map.style._layers) {
			const layer = map.style._layers[layerId];
			if (layer.source !== id) continue;
			map.removeLayer(layerId);
		}

		map.removeSource(id);
	}, [id, map]);

	useEffect(() => {
		let abort = false;

		const onLoad = () => {
			if (abort) return;

			if (map.getSource(id) !== undefined) {
				removeSource();
			}

			map.addSource(id, specification);
			setSource(map.getSource<T>(id)!);
		};

		if (map.style._loaded) onLoad();
		else map.on("load", onLoad);

		return () => {
			abort = true;
			map.off("load", onLoad);

			if (map.style !== undefined && map.getSource(id) !== undefined) {
				removeSource();
			}

			setSource(null);
		};
	}, [id, map, removeSource, specification]);

	return source;
}

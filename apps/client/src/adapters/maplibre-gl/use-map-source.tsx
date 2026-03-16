import type { SourceSpecification } from "maplibre-gl";
import { useCallback, useEffect, useState } from "react";

import { useMap } from "~/adapters/maplibre-gl/map";

export function useMapSource<T extends maplibregl.Source>(id: string, specification: SourceSpecification) {
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

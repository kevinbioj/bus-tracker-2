import type { SourceSpecification } from "maplibre-gl";
import { useEffect, useState } from "react";

import { useMap } from "~/adapters/maplibre-gl/map";

export function useMapSource<T extends maplibregl.Source>(id: string, specification: SourceSpecification) {
	const map = useMap();
	const [source, setSource] = useState<T | null>(null);

	useEffect(() => {
		const onLoad = () => {
			if (!map.getSource(id)) map.addSource(id, specification);
			setSource(map.getSource<T>(id) ?? null);
		};

		map.once("load", onLoad);
		return () => setSource(null);
	}, [id, map, specification]);

	return source;
}

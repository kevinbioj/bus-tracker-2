import type maplibregl from "maplibre-gl";
import { useEffect, useState } from "react";

import { useMap } from "~/adapters/maplibre-gl/map";

export function useMapBounds() {
	const map = useMap();
	const [bounds, setBounds] = useState<maplibregl.LngLatBounds>(map.getBounds());

	useEffect(() => {
		const onMoveEnd = () => setBounds(map.getBounds());
		map.on("moveend", onMoveEnd);
		return () => void map.off("moveend", onMoveEnd);
	}, [map]);

	return bounds;
}

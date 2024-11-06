import type { Map as LeafletMap } from "leaflet";
import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";

export type MapBounds = {
	sw: [number, number];
	ne: [number, number];
};

const computeBounds = (map: LeafletMap): MapBounds => {
	const bounds = map.getBounds();
	const swBounds = bounds.getSouthWest();
	const neBounds = bounds.getNorthEast();

	return {
		sw: [swBounds.lat, swBounds.lng],
		ne: [neBounds.lat, neBounds.lng],
	};
};

export function useMapBounds() {
	const map = useMap();

	const [bounds, setBounds] = useState<MapBounds>(() => computeBounds(map));

	useEffect(() => {
		const onMoveEnd = () => {
			const computedBounds = computeBounds(map);
			setBounds(computedBounds);
		};

		map.addEventListener("moveend", onMoveEnd);
		return () => void map.removeEventListener("moveend", onMoveEnd);
	}, [map]);

	return bounds;
}

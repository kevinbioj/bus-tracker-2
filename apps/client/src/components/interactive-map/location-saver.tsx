"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { useLocalStorage } from "usehooks-ts";

export function LocationSaver() {
	const map = useMap();
	const [, setLastLocation] = useLocalStorage<[number, number, number] | null>("last-location", null);
	useEffect(() => {
		const onMoveEnd = () => {
			const { lat, lng } = map.getCenter();
			setLastLocation([lat, lng, map.getZoom()]);
		};
		map.addEventListener("moveend", onMoveEnd);
		return () => void map.removeEventListener("moveend", onMoveEnd);
	}, [map, setLastLocation]);
	return null;
}

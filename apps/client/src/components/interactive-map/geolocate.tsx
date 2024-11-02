"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { useLocalStorage } from "usehooks-ts";

export function Geolocate() {
	const [geolocate] = useLocalStorage("geolocation", false);
	const map = useMap();
	useEffect(() => {
		if (!geolocate) return;
		const previous = map.getCenter();
		navigator.geolocation.getCurrentPosition(
			(position) => {
				if (!previous.equals(map.getCenter())) return;
				const { latitude, longitude } = position.coords;
				map.setView([latitude, longitude], 16);
			},
			undefined,
			{ enableHighAccuracy: true, timeout: 5_000 },
		);
	}, [geolocate, map]);
	return null;
}

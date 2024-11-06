"use client";

import { useEffect, useRef, useState } from "react";
import { CircleMarker, useMap } from "react-leaflet";
import { useLocalStorage } from "usehooks-ts";

export function Geolocate() {
	const [position, setPosition] = useState<[number, number]>();
	const [geolocate] = useLocalStorage("geolocation", false);
	const hasInstantiatedView = useRef(false);

	const map = useMap();

	useEffect(() => {
		if (!geolocate) return;

		navigator.geolocation.watchPosition(
			(position) => {
				const { latitude, longitude } = position.coords;
				if (!hasInstantiatedView.current) {
					map.setView([latitude, longitude], 16);
					hasInstantiatedView.current = true;
				}
				setPosition([latitude, longitude]);
			},
			undefined,
			{ enableHighAccuracy: true, maximumAge: 15_000, timeout: 5_000 },
		);
	}, [geolocate, map]);

	return typeof position !== "undefined" ? (
		<CircleMarker center={position} fillColor="#4285F4" fillOpacity={1} radius={4} stroke />
	) : null;
}

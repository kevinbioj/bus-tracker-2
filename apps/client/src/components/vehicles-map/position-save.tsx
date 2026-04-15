import { useEffect } from "react";
import { useLocalStorage } from "usehooks-ts";

import { useMap } from "~/adapters/maplibre-gl/map";

export const DEFAULT_LOCATION = {
	position: { lng: 3.00332, lat: 47.01826 },
	zoom: 5.15,
};

export function PositionSave() {
	const map = useMap();
	const [, setCurrentLocation] = useLocalStorage("current-location", DEFAULT_LOCATION);

	// biome-ignore lint/correctness/useExhaustiveDependencies: setCurrentLocation is a state setter
	useEffect(() => {
		let timeoutId: ReturnType<typeof setTimeout> | undefined;

		const onMoveEnd = () => {
			const center = map.getCenter();
			const lng = +center.lng.toFixed(3);
			const lat = +center.lat.toFixed(3);
			const zoom = +map.getZoom().toFixed(2);

			setCurrentLocation({
				position: { lng, lat },
				zoom,
			});

			if (timeoutId !== undefined) {
				clearTimeout(timeoutId);
			}

			timeoutId = setTimeout(() => {
				const search = window.location.search;
				window.history.replaceState(null, "", `${search}#${lng},${lat},${zoom}`);
			}, 500);
		};

		map.on("moveend", onMoveEnd);
		return () => {
			map.off("moveend", onMoveEnd);
			clearTimeout(timeoutId);
		};
	}, [map]);

	return null;
}

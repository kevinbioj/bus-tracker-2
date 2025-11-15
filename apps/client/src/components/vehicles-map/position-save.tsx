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
		let timeoutId: number | undefined;

		const onMoveEnd = () => {
			const { lng, lat } = map.getCenter();
			const zoom = +map.getZoom().toFixed(0);

			setCurrentLocation({
				position: { lng, lat },
				zoom,
			});

			if (timeoutId !== undefined) {
				clearTimeout(timeoutId);
			}

			timeoutId = setTimeout(() => window.history.replaceState(null, "", `#${lng},${lat},${zoom}`), 500);
		};

		map.on("moveend", onMoveEnd);
		return () => {
			void map.off("moveend", onMoveEnd);
			clearTimeout(timeoutId);
		};
	}, [map]);

	return null;
}

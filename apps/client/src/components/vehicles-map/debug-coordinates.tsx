import { type MapMouseEvent, Popup } from "maplibre-gl";
import { useEffect, useState } from "react";
import { useLocalStorage } from "usehooks-ts";

import { useMap } from "~/adapters/maplibre-gl/map";

/** Affiche les coordonnées du point cliqué quand `debug-show-coordinates` vaut `true` dans le localStorage. */
export function DebugCoordinates() {
	const [showCoordinates] = useLocalStorage("debug-show-coordinates", false);
	return showCoordinates ? <DebugCoordinatesPopup /> : null;
}

function DebugCoordinatesPopup() {
	const map = useMap();
	const [popup] = useState(() => new Popup({ anchor: "bottom", closeOnClick: false, maxWidth: "none" }));

	useEffect(() => {
		const content = document.createElement("div");
		content.className = "px-3 py-2 pr-6 font-mono text-sm select-all";

		const onClick = (event: MapMouseEvent) => {
			const { lat, lng } = event.lngLat;
			content.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
			popup.setLngLat(event.lngLat);
			if (!popup.isOpen()) popup.setDOMContent(content).addTo(map);
		};

		map.on("click", onClick);
		return () => {
			map.off("click", onClick);
			popup.remove();
		};
	}, [map, popup]);

	return null;
}

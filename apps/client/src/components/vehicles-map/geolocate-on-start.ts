import type { GeolocateControl, Map as MaplibreMap } from "maplibre-gl";
import { useLocalStorage } from "usehooks-ts";

export function useGeolocateOnStart() {
	return useLocalStorage("geolocate-on-start", false);
}

const READY_POLL_INTERVAL = 100;
const READY_POLL_ATTEMPTS = 50;

// Le contrôle ignore `trigger()` tant qu'il n'a pas fini de vérifier le support de la géolocalisation,
// ce qu'il fait de façon asynchrone après son ajout à la carte : son bouton reste désactivé jusque-là.
export function triggerGeolocateWhenReady(map: MaplibreMap, control: GeolocateControl) {
	let attempts = 0;

	const attempt = () => {
		const button = map.getContainer().querySelector<HTMLButtonElement>("button.maplibregl-ctrl-geolocate");
		if (button !== null && !button.disabled) {
			control.trigger();
			return;
		}

		attempts += 1;
		if (attempts < READY_POLL_ATTEMPTS) setTimeout(attempt, READY_POLL_INTERVAL);
	};

	attempt();
}

import type { GeolocateControl, Map as MaplibreMap } from "maplibre-gl";
import { useLocalStorage } from "usehooks-ts";

export function useGeolocateOnStart() {
	return useLocalStorage("geolocate-on-start", false);
}

export type UserPosition = { latitude: number; longitude: number };

const geolocateControls = new WeakMap<MaplibreMap, GeolocateControl>();
const userPositions = new WeakMap<MaplibreMap, UserPosition>();

export function registerGeolocateControl(map: MaplibreMap, control: GeolocateControl) {
	geolocateControls.set(map, control);
	control.on("geolocate", ({ coords }: { coords: GeolocationCoordinates }) => {
		userPositions.set(map, { latitude: coords.latitude, longitude: coords.longitude });
	});
}

export const getGeolocateControl = (map: MaplibreMap) => geolocateControls.get(map);

export const getUserPosition = (map: MaplibreMap) => userPositions.get(map);

const READY_POLL_INTERVAL = 100;
const READY_POLL_ATTEMPTS = 50;

// Le contrôle ignore `trigger()` tant qu'il n'a pas fini de vérifier le support de la géolocalisation,
// ce qu'il fait de façon asynchrone après son ajout à la carte : son bouton reste désactivé jusque-là.
export function triggerGeolocateWhenReady(map: MaplibreMap, control: GeolocateControl) {
	return new Promise<boolean>((resolve) => {
		let attempts = 0;

		const attempt = () => {
			const button = map.getContainer().querySelector<HTMLButtonElement>("button.maplibregl-ctrl-geolocate");
			if (button !== null && !button.disabled) {
				control.trigger();
				resolve(true);
				return;
			}

			attempts += 1;
			if (attempts < READY_POLL_ATTEMPTS) setTimeout(attempt, READY_POLL_INTERVAL);
			else resolve(false);
		};

		attempt();
	});
}

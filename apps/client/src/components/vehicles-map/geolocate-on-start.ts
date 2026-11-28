import type { GeolocateControl, Map as MaplibreMap } from "maplibre-gl";
import { useCallback, useSyncExternalStore } from "react";
import { useLocalStorage } from "usehooks-ts";

export function useGeolocateOnStart() {
	return useLocalStorage("geolocate-on-start", false);
}

export type UserPosition = { latitude: number; longitude: number };

export type UserGeolocation = {
	position?: UserPosition;
	status: "idle" | "pending" | "located" | "denied" | "unavailable";
};

const IDLE_GEOLOCATION: UserGeolocation = { status: "idle" };

const geolocateControls = new WeakMap<MaplibreMap, GeolocateControl>();
const geolocations = new WeakMap<MaplibreMap, UserGeolocation>();
const geolocationListeners = new WeakMap<MaplibreMap, Set<() => void>>();
const trackingStartListeners = new WeakMap<MaplibreMap, Set<() => void>>();

export function onUserLocationTrackingStart(map: MaplibreMap, listener: () => void) {
	let listeners = trackingStartListeners.get(map);
	if (listeners === undefined) {
		listeners = new Set();
		trackingStartListeners.set(map, listeners);
	}
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

function setGeolocation(map: MaplibreMap, geolocation: UserGeolocation) {
	geolocations.set(map, geolocation);
	for (const listener of geolocationListeners.get(map) ?? []) listener();
}

export function registerGeolocateControl(map: MaplibreMap, control: GeolocateControl) {
	geolocateControls.set(map, control);
	control.on("geolocate", ({ coords }: { coords: GeolocationCoordinates }) => {
		setGeolocation(map, { position: { latitude: coords.latitude, longitude: coords.longitude }, status: "located" });
	});
	control.on("trackuserlocationstart", () => {
		for (const listener of trackingStartListeners.get(map) ?? []) listener();
	});
	control.on("error", ({ code }) => {
		setGeolocation(map, {
			position: geolocations.get(map)?.position,
			status: code === GeolocationPositionError.PERMISSION_DENIED ? "denied" : "unavailable",
		});
	});
}

export const getGeolocateControl = (map: MaplibreMap) => geolocateControls.get(map);

export const getUserPosition = (map: MaplibreMap) => geolocations.get(map)?.position;

export function useUserGeolocation(map: MaplibreMap) {
	const subscribe = useCallback(
		(listener: () => void) => {
			let listeners = geolocationListeners.get(map);
			if (listeners === undefined) {
				listeners = new Set();
				geolocationListeners.set(map, listeners);
			}
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		[map],
	);
	return useSyncExternalStore(subscribe, () => geolocations.get(map) ?? IDLE_GEOLOCATION);
}

export function watchUserPosition(map: MaplibreMap) {
	if (!("geolocation" in navigator)) {
		setGeolocation(map, { status: "unavailable" });
		return () => {};
	}

	const current = geolocations.get(map);
	if (current?.position === undefined) setGeolocation(map, { status: "pending" });

	const watchId = navigator.geolocation.watchPosition(
		({ coords }) => {
			setGeolocation(map, { position: { latitude: coords.latitude, longitude: coords.longitude }, status: "located" });
		},
		({ code }) => {
			setGeolocation(map, {
				position: geolocations.get(map)?.position,
				status: code === GeolocationPositionError.PERMISSION_DENIED ? "denied" : "unavailable",
			});
		},
		{ enableHighAccuracy: true, maximumAge: 30_000 },
	);
	return () => navigator.geolocation.clearWatch(watchId);
}

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

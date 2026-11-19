import { useSyncExternalStore } from "react";

const MAP_TOUR_SEEN_KEY = "onboarding-seen";
const VEHICLE_POPUP_TOUR_SEEN_KEY = "onboarding-vehicle-popup-seen";
const PENDING_KEY = "onboarding-pending";
const RETURNING_VISITOR_KEYS = ["current-location", "show-stops", "show-vehicle-paths", "geolocate-on-start"];

function readStorage(key: string) {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function markStorage(key: string) {
	try {
		localStorage.setItem(key, new Date().toISOString());
	} catch {}
}

export type MapTourTrigger = "first-visit" | "replay";

type OnboardingState = {
	mapTour: MapTourTrigger | null;
	mapTourActive: boolean;
	vehiclePopupTour: boolean;
};

let state = ((): OnboardingState => {
	const unseen = readStorage(MAP_TOUR_SEEN_KEY) === null;
	const legacyVisitor =
		unseen && readStorage(PENDING_KEY) === null && RETURNING_VISITOR_KEYS.some((key) => readStorage(key) !== null);
	if (legacyVisitor) {
		markStorage(MAP_TOUR_SEEN_KEY);
		markStorage(VEHICLE_POPUP_TOUR_SEEN_KEY);
	} else if (unseen) {
		markStorage(PENDING_KEY);
	}

	return {
		mapTour: readStorage(MAP_TOUR_SEEN_KEY) === null ? "first-visit" : null,
		mapTourActive: false,
		vehiclePopupTour: readStorage(VEHICLE_POPUP_TOUR_SEEN_KEY) === null,
	};
})();

const listeners = new Set<() => void>();

function update(patch: Partial<OnboardingState>) {
	state = { ...state, ...patch };
	for (const listener of listeners) listener();
}

export function startMapTour() {
	update({ mapTour: null, mapTourActive: true });
}

export function markMapTourSeen() {
	markStorage(MAP_TOUR_SEEN_KEY);
}

export function endMapTour() {
	update({ mapTourActive: false });
}

export function startVehiclePopupTour() {
	update({ vehiclePopupTour: false });
}

export function markVehiclePopupTourSeen() {
	markStorage(VEHICLE_POPUP_TOUR_SEEN_KEY);
}

export function replayOnboarding() {
	update({ mapTour: "replay", vehiclePopupTour: true });
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

const getSnapshot = () => state;

export function useOnboardingState() {
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

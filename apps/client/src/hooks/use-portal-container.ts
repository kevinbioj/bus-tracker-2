import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
	document.addEventListener("fullscreenchange", onChange);
	return () => document.removeEventListener("fullscreenchange", onChange);
}

function getFullscreenElement() {
	return (document.fullscreenElement as HTMLElement | null) ?? undefined;
}

function getServerSnapshot() {
	return undefined;
}

export function usePortalContainer() {
	return useSyncExternalStore(subscribe, getFullscreenElement, getServerSnapshot);
}

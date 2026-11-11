import type { FullscreenControl } from "maplibre-gl";
import { createContext, useContext, useSyncExternalStore } from "react";

const PSEUDO_FULLSCREEN_CHANGE = "pseudofullscreenchange";

function subscribe(onChange: () => void) {
	const events = ["fullscreenchange", "webkitfullscreenchange", PSEUDO_FULLSCREEN_CHANGE];
	for (const event of events) document.addEventListener(event, onChange);
	return () => {
		for (const event of events) document.removeEventListener(event, onChange);
	};
}

function getFullscreenElement() {
	const fullscreenElement =
		document.fullscreenElement ??
		(document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement ??
		document.querySelector(".maplibregl-pseudo-fullscreen");
	return (fullscreenElement as HTMLElement | null) ?? undefined;
}

function getServerSnapshot() {
	return undefined;
}

export const PortalThemeContext = createContext<"light" | "dark" | undefined>(undefined);

export function usePortalProps() {
	const container = useSyncExternalStore(subscribe, getFullscreenElement, getServerSnapshot);
	const theme = useContext(PortalThemeContext);
	return { container, "data-map-theme": theme };
}

export function notifyPseudoFullscreen(control: FullscreenControl) {
	const notify = () => document.dispatchEvent(new Event(PSEUDO_FULLSCREEN_CHANGE));
	control.on("fullscreenstart", notify);
	control.on("fullscreenend", notify);
	return control;
}

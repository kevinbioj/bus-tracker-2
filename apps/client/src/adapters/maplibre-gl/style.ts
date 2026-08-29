import type { Map as MaplibreMap } from "maplibre-gl";

/**
 * `map.style` is not always there: maplibre deletes it when the map is removed (`map.remove()` calls
 * `setStyle(null)`) and sets it back to `null` when the WebGL context is lost, so it can never be
 * dereferenced without a guard. Sources, layers and images only exist while the style is loaded.
 */
export function isStyleLoaded(map: MaplibreMap) {
	return map.style?._loaded === true;
}

/**
 * Tells a style that failed to load – still there, just never `_loaded` – apart from one maplibre
 * took away. Nothing outside maplibre may set a style back while it is gone: `_contextRestored()`
 * restores the one it saved and would overwrite anything put there in the meantime.
 */
export function hasStyle(map: MaplibreMap) {
	return map.style != null;
}

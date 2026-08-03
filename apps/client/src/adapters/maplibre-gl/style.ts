import type { Map as MaplibreMap } from "maplibre-gl";

/**
 * `map.style` is not always there: maplibre deletes it when the map is removed (`map.remove()` calls
 * `setStyle(null)`) and sets it back to `null` when the WebGL context is lost, so it can never be
 * dereferenced without a guard. Sources, layers and images only exist while the style is loaded.
 */
export function isStyleLoaded(map: MaplibreMap) {
	return map.style?._loaded === true;
}

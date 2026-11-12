import type { Map as MaplibreMap, StyleSpecification } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { useLocalStorage, useMediaQuery } from "usehooks-ts";

import { useMap } from "~/adapters/maplibre-gl/map";
import { useEmbedDisplaySettings } from "~/components/vehicles-map/embed-display-settings";

export type MapThemeSetting = "auto" | "light" | "dark";
export type MapTheme = "light" | "dark";

const DARK_MAP_BACKGROUND = [0x31, 0x35, 0x3e] as const;
const DARK_MAP_DIMMING = 0.125;

export function useMapThemeSetting() {
	return useLocalStorage<MapThemeSetting>("map-theme", "auto");
}

export function useMapTheme(): MapTheme {
	const embedded = useEmbedDisplaySettings() !== null;
	const [setting] = useMapThemeSetting();
	const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
	if (embedded) return "light";
	if (setting === "auto") return prefersDark ? "dark" : "light";
	return setting;
}

export function getMapStyleUrl(theme: MapTheme) {
	return theme === "dark" ? "/map-styles/liberty-fr-dark.json" : "/map-styles/liberty-fr.json";
}

export function withAbsoluteSpriteUrls(_previous: StyleSpecification | undefined, next: StyleSpecification) {
	if (!Array.isArray(next.sprite)) return next;
	return {
		...next,
		sprite: next.sprite.map(({ id, url }) => ({ id, url: new URL(url, location.href).href })),
	};
}

/**
 * Les deux styles partagent sources et couches : on reprend les couches du style courant dans leur
 * ordre, celles du fond de carte remplacées par leur pendant, celles de l'application conservées. Le
 * changement se résume alors à des couleurs, appliquées sans recharger la carte.
 */
function keepApplicationLayers(previous: StyleSpecification | undefined, style: StyleSpecification) {
	const next = withAbsoluteSpriteUrls(previous, style);
	if (previous === undefined) return next;

	const nextLayers = new Map(next.layers.map((layer) => [layer.id, layer]));
	const applicationSources = Object.fromEntries(
		Object.entries(previous.sources).filter(([id]) => !(id in next.sources)),
	);

	return {
		...next,
		sources: { ...next.sources, ...applicationSources },
		layers: previous.layers.map((layer) => nextLayers.get(layer.id) ?? layer),
	};
}

type MapThemeStyleProps = {
	/** Thème du style passé à la création de la carte. */
	initialTheme: MapTheme;
	theme: MapTheme;
};

export function MapThemeStyle({ initialTheme, theme }: Readonly<MapThemeStyleProps>) {
	const map = useMap();
	const applied = useRef<{ map: MaplibreMap; theme: MapTheme } | null>(null);

	useEffect(() => {
		if (applied.current?.map !== map) {
			applied.current = { map, theme: initialTheme };
		}
		if (applied.current.theme === theme) return;

		applied.current.theme = theme;
		map.setStyle(getMapStyleUrl(theme), { transformStyle: keepApplicationLayers });
		map.setGlobalStateProperty("darkMode", theme === "dark");
	}, [map, initialTheme, theme]);

	return null;
}

export function dimForDarkMap(color: string) {
	const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color)?.[1];
	if (hex === undefined) return color;

	const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
	return `#${[0, 2, 4]
		.map((offset, i) => {
			const channel = Number.parseInt(full.slice(offset, offset + 2), 16);
			const dimmed = Math.round(channel * (1 - DARK_MAP_DIMMING) + DARK_MAP_BACKGROUND[i]! * DARK_MAP_DIMMING);
			return dimmed.toString(16).padStart(2, "0");
		})
		.join("")}`;
}

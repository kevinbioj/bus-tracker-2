/**
 * Éléments posés sur le bas de la carte et qui en masquent une partie — les drawers de la carte sur
 * mobile. Ceux qui recentrent la carte s'en servent pour viser la partie restée visible.
 */
const bottomOverlays = new Set<HTMLElement>();

/**
 * Déclare un élément qui masque le bas de la carte. Renvoie de quoi le retirer : la forme attendue
 * d'une ref de React, à qui l'on peut passer directement cette fonction.
 */
export function registerMapBottomOverlay(element: HTMLElement | null) {
	if (element === null) return;
	bottomOverlays.add(element);
	return () => {
		bottomOverlays.delete(element);
	};
}

/** Hauteur de la carte masquée par ces éléments, mesurée à l'instant de l'appel. */
export function getMapBottomOverlayHeight(mapContainer: HTMLElement) {
	const mapRect = mapContainer.getBoundingClientRect();
	let hiddenHeight = 0;
	for (const overlay of bottomOverlays) {
		if (!overlay.isConnected) continue;
		const overlayRect = overlay.getBoundingClientRect();
		hiddenHeight = Math.max(hiddenHeight, mapRect.bottom - overlayRect.top);
	}
	return Math.min(mapRect.height, hiddenHeight);
}

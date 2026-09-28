import { useLocalStorage } from "usehooks-ts";

/** Affichage de l'accessibilité PMR des arrêts et des courses : masquée par défaut. */
export function useShowWheelchairAccessibility() {
	return useLocalStorage("show-wheelchair-accessibility", false);
}

/** Affichage de la prise en charge des vélos par les courses : masquée par défaut. */
export function useShowBikesAllowed() {
	return useLocalStorage("show-bikes-allowed", false);
}

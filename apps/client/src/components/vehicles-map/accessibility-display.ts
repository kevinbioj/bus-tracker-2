import { useLocalStorage } from "usehooks-ts";

import { useEmbedDisplaySettings } from "~/components/vehicles-map/embed-display-settings";

/** Affichage de l'accessibilité PMR des arrêts et des courses : masquée par défaut. */
export function useShowWheelchairAccessibility() {
	const embedSettings = useEmbedDisplaySettings();
	const [show, setShow] = useLocalStorage("show-wheelchair-accessibility", false);
	// Sur la carte embarquée, son propre réglage l'emporte, sans toucher aux préférences de l'application.
	if (embedSettings !== null) {
		return [embedSettings.showWheelchairAccessibility, embedSettings.setShowWheelchairAccessibility] as const;
	}
	return [show, setShow] as const;
}

/** Affichage de la prise en charge des vélos par les courses : masquée par défaut. */
export function useShowBikesAllowed() {
	const embedSettings = useEmbedDisplaySettings();
	const [show, setShow] = useLocalStorage("show-bikes-allowed", false);
	// Sur la carte embarquée, son propre réglage l'emporte, sans toucher aux préférences de l'application.
	if (embedSettings !== null) {
		return [embedSettings.showBikesAllowed, embedSettings.setShowBikesAllowed] as const;
	}
	return [show, setShow] as const;
}

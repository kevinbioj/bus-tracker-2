import { useLocalStorage } from "usehooks-ts";

import { useEmbedDisplaySettings } from "~/components/vehicles-map/embed-display-settings";

export const nextCallsDisplayModes = ["absolute", "relative"] as const;

export type NextCallsDisplayMode = (typeof nextCallsDisplayModes)[number];

export function useNextCallsDisplayMode() {
	const embedSettings = useEmbedDisplaySettings();
	const [displayMode, setDisplayMode] = useLocalStorage<NextCallsDisplayMode>("next-calls-display-mode", "absolute");
	// Sur la carte embarquée, son propre réglage l'emporte, sans toucher aux préférences de l'application.
	if (embedSettings !== null) {
		return [embedSettings.nextCallsDisplayMode, embedSettings.setNextCallsDisplayMode] as const;
	}
	return [displayMode, setDisplayMode] as const;
}

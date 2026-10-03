import { createContext, type Dispatch, type ReactNode, type SetStateAction, useContext, useMemo } from "react";
import { useLocalStorage } from "usehooks-ts";

import type { NextCallsDisplayMode } from "~/components/vehicles-map/next-calls-display-mode";

type DisplaySettingsValues = {
	nextCallsDisplayMode: NextCallsDisplayMode;
	showWheelchairAccessibility: boolean;
	showBikesAllowed: boolean;
};

/**
 * Réglages d'affichage de la carte embarquée. Ils l'emportent sur les préférences de l'application :
 * l'intégrateur fixe leur valeur de départ, que le visiteur ajuste depuis la carte.
 */
export type EmbedDisplaySettings = DisplaySettingsValues & {
	setNextCallsDisplayMode: Dispatch<SetStateAction<NextCallsDisplayMode>>;
	setShowWheelchairAccessibility: Dispatch<SetStateAction<boolean>>;
	setShowBikesAllowed: Dispatch<SetStateAction<boolean>>;
};

const EmbedDisplaySettingsContext = createContext<EmbedDisplaySettings | null>(null);

type EmbedDisplaySettingsProviderProps = {
	children: ReactNode;
	/** Réseau de la carte : chaque réseau embarqué garde ses propres réglages. */
	networkId: number;
	/** Valeurs choisies par l'intégrateur, tant que le visiteur ne les a pas changées. */
	initialSettings: DisplaySettingsValues;
};

export function EmbedDisplaySettingsProvider({
	children,
	networkId,
	initialSettings,
}: Readonly<EmbedDisplaySettingsProviderProps>) {
	// Seuls les réglages que le visiteur a changés sont retenus : les autres suivent l'intégrateur, même
	// s'il revient ensuite sur ses choix. La clé distingue les réseaux, qu'une même page — ou deux sites,
	// sur un navigateur qui ne cloisonne pas le stockage des iframes — peut embarquer côte à côte.
	const [changedSettings, setChangedSettings] = useLocalStorage<Partial<DisplaySettingsValues>>(
		`embed-display-settings:${networkId}`,
		{},
	);

	const settings = useMemo(() => {
		const values = { ...initialSettings, ...changedSettings };

		const setterOf =
			<K extends keyof DisplaySettingsValues>(key: K): Dispatch<SetStateAction<DisplaySettingsValues[K]>> =>
			(action) =>
				setChangedSettings((previous) => {
					const current = { ...initialSettings, ...previous }[key];
					const next =
						typeof action === "function"
							? (action as (value: DisplaySettingsValues[K]) => DisplaySettingsValues[K])(current)
							: action;
					return { ...previous, [key]: next };
				});

		return {
			...values,
			setNextCallsDisplayMode: setterOf("nextCallsDisplayMode"),
			setShowWheelchairAccessibility: setterOf("showWheelchairAccessibility"),
			setShowBikesAllowed: setterOf("showBikesAllowed"),
		};
	}, [changedSettings, initialSettings, setChangedSettings]);

	return <EmbedDisplaySettingsContext.Provider value={settings}>{children}</EmbedDisplaySettingsContext.Provider>;
}

/** Réglages de la carte embarquée, `null` hors de celle-ci. */
export function useEmbedDisplaySettings() {
	return useContext(EmbedDisplaySettingsContext);
}

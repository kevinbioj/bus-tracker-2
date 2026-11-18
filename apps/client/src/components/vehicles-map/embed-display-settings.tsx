import { createContext, type Dispatch, type ReactNode, type SetStateAction, useContext, useMemo } from "react";
import { useLocalStorage } from "usehooks-ts";

import type { NextCallsDisplayMode } from "~/components/vehicles-map/next-calls-display-mode";

type DisplaySettingsValues = {
	nextCallsDisplayMode: NextCallsDisplayMode;
	displayAbsoluteRecordedTime: boolean;
	showWheelchairAccessibility: boolean;
	showBikesAllowed: boolean;
};

type DisplaySettingKey = keyof DisplaySettingsValues;

type Setters = { [K in DisplaySettingKey]: Dispatch<SetStateAction<DisplaySettingsValues[K]>> };

/**
 * Réglages d'affichage de la carte embarquée. Ils l'emportent sur les préférences de l'application :
 * l'intégrateur fixe leur valeur de départ, que le visiteur ajuste depuis la carte.
 */
type EmbedDisplaySettings = { values: DisplaySettingsValues; setters: Setters };

/** Préférences de l'application, hors de la carte embarquée. */
const applicationSettings: {
	[K in DisplaySettingKey]: { storageKey: string; defaultValue: DisplaySettingsValues[K] };
} = {
	nextCallsDisplayMode: { storageKey: "next-calls-display-mode", defaultValue: "absolute" },
	displayAbsoluteRecordedTime: { storageKey: "display-absolute-time", defaultValue: false },
	showWheelchairAccessibility: { storageKey: "show-wheelchair-accessibility", defaultValue: false },
	showBikesAllowed: { storageKey: "show-bikes-allowed", defaultValue: false },
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

	const settings = useMemo((): EmbedDisplaySettings => {
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
			values,
			setters: {
				nextCallsDisplayMode: setterOf("nextCallsDisplayMode"),
				displayAbsoluteRecordedTime: setterOf("displayAbsoluteRecordedTime"),
				showWheelchairAccessibility: setterOf("showWheelchairAccessibility"),
				showBikesAllowed: setterOf("showBikesAllowed"),
			},
		};
	}, [changedSettings, initialSettings, setChangedSettings]);

	return <EmbedDisplaySettingsContext.Provider value={settings}>{children}</EmbedDisplaySettingsContext.Provider>;
}

export function useIsEmbedded() {
	return useContext(EmbedDisplaySettingsContext) !== null;
}

/** Réglage d'affichage : celui de la carte embarquée, à défaut la préférence de l'application. */
export function useDisplaySetting<K extends DisplaySettingKey>(key: K) {
	const embedSettings = useContext(EmbedDisplaySettingsContext);
	const { storageKey, defaultValue } = applicationSettings[key];
	const [value, setValue] = useLocalStorage<DisplaySettingsValues[K]>(storageKey, defaultValue);
	if (embedSettings !== null) return [embedSettings.values[key], embedSettings.setters[key]] as const;
	return [value, setValue] as const;
}

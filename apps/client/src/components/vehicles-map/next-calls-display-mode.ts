import { useDisplaySetting } from "~/components/vehicles-map/embed-display-settings";

export const nextCallsDisplayModes = ["absolute", "relative"] as const;

export type NextCallsDisplayMode = (typeof nextCallsDisplayModes)[number];

export const useNextCallsDisplayMode = () => useDisplaySetting("nextCallsDisplayMode");

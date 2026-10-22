import { useLocalStorage } from "usehooks-ts";

export const stopLinesDisplayModes = ["without", "with"] as const;

export type StopLinesDisplayMode = (typeof stopLinesDisplayModes)[number];

export function useStopLinesDisplayMode() {
	return useLocalStorage<StopLinesDisplayMode>("stop-lines-display-mode", "with");
}

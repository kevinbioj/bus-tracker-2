import { useLocalStorage } from "usehooks-ts";

export const nextCallsDisplayModes = ["absolute", "relative"] as const;

export type NextCallsDisplayMode = (typeof nextCallsDisplayModes)[number];

export function useNextCallsDisplayMode() {
	return useLocalStorage<NextCallsDisplayMode>("next-calls-display-mode", "absolute");
}

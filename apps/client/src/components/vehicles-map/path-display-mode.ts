import { useLocalStorage } from "usehooks-ts";

export const pathDisplayModes = ["disabled", "journeys", "journeys-and-lines"] as const;

export type PathDisplayMode = (typeof pathDisplayModes)[number];

export function usePathDisplayMode() {
	const [storedMode, setStoredMode] = useLocalStorage<PathDisplayMode | undefined>("path-display-mode", undefined);
	const [legacyShowVehiclePaths] = useLocalStorage("show-vehicle-paths", true);

	return [storedMode ?? (legacyShowVehiclePaths ? "journeys-and-lines" : "disabled"), setStoredMode] as const;
}

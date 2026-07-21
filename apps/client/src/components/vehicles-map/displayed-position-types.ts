import { useLocalStorage } from "usehooks-ts";

export const positionTypes = ["GPS", "ESTIMATED", "SCHEDULED"] as const;

export type PositionType = (typeof positionTypes)[number];

const allPositionTypes = [...positionTypes];
const withoutScheduled: PositionType[] = ["GPS", "ESTIMATED"];

const fallback = (legacyHideScheduledTrips: boolean) =>
	legacyHideScheduledTrips ? withoutScheduled : allPositionTypes;

export function readDisplayedPositionTypes(): PositionType[] {
	const storedTypes = localStorage.getItem("displayed-position-types");

	if (storedTypes !== null) {
		try {
			const parsedTypes: unknown = JSON.parse(storedTypes);
			if (Array.isArray(parsedTypes)) {
				return parsedTypes.filter((type): type is PositionType => positionTypes.includes(type));
			}
		} catch {
			// valeur corrompue : on retombe sur le comportement par défaut
		}
	}

	return fallback(localStorage.getItem("hide-scheduled-trips") === "true");
}

export function useDisplayedPositionTypes() {
	const [storedTypes, setStoredTypes] = useLocalStorage<PositionType[] | undefined>(
		"displayed-position-types",
		undefined,
	);
	const [legacyHideScheduledTrips] = useLocalStorage("hide-scheduled-trips", false);

	return [storedTypes ?? fallback(legacyHideScheduledTrips), setStoredTypes] as const;
}

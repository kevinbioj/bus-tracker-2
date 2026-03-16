import type { VehicleJourneyPath } from "@bus-tracker/contracts";
import { journeyStore } from "./journey-store.js";

export const pathStore = new Map<string, VehicleJourneyPath>();

setInterval(() => {
	const activePathRefs = new Set<string>();
	for (const journey of journeyStore.values()) {
		if (journey.pathRef) {
			activePathRefs.add(journey.pathRef);
		}
	}

	let sweptPaths = 0;
	for (const pathRef of pathStore.keys()) {
		if (!activePathRefs.has(pathRef)) {
			pathStore.delete(pathRef);
			sweptPaths++;
		}
	}

	if (sweptPaths > 0) {
		console.log("► Swept %d unreferenced route paths.", sweptPaths);
	}
}, 3600_000);

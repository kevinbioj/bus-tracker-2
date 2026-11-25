import { afterEach, describe, expect, it, vi } from "vitest";

import type { DisposeableVehicleJourney } from "../../types/disposeable-vehicle-journey.js";
import { journeyStore, onJourneysChanged, withdrawJourneys } from "./journey-store.js";

const journey = (id: string, type: "GPS" | "COMPUTED") =>
	({
		id,
		networkId: 1,
		countryCode: "FR",
		position: { latitude: 0, longitude: 0, atStop: false, type, recordedAt: "2026-11-25T09:00:00Z" },
		updatedAt: "2026-11-25T09:00:00Z",
	}) as DisposeableVehicleJourney;

describe("withdrawJourneys", () => {
	afterEach(() => {
		journeyStore.clear();
	});

	it("retire les courses calculées et préserve celles suivies en GPS", () => {
		journeyStore.set("computed", journey("computed", "COMPUTED"));
		journeyStore.set("gps", journey("gps", "GPS"));
		const listener = vi.fn();
		const unsubscribe = onJourneysChanged(listener);

		withdrawJourneys(["computed", "gps", "unknown"]);
		unsubscribe();

		expect([...journeyStore.keys()]).toEqual(["gps"]);
		expect(listener).toHaveBeenCalledExactlyOnceWith(["computed"]);
	});
});

import { describe, expect, it, vi } from "vitest";

import { buildNearbyDepartures } from "../../../core/services/nearby-departures-service.js";
import { getNearbyDeparturesTool } from "./get-nearby-departures.js";

vi.mock("../../../core/services/nearby-departures-service.js", () => ({ buildNearbyDepartures: vi.fn() }));
vi.mock("../../lookups/lines.js", () => ({
	loadLineLabels: vi.fn(async () => new Map([[10, { id: 10, number: "T1", type: "TRAMWAY", networkId: 1 }]])),
}));
vi.mock("../../lookups/networks.js", () => ({
	loadNetworks: vi.fn(async () => new Map([[1, { id: 1, name: "Réseau Astuce", timezone: "Europe/Paris" }]])),
}));

describe("get_nearby_departures", () => {
	it("presents departures with their stop, distance and local times", async () => {
		const aimedTime = new Date(Date.now() + 10 * 60_000).toISOString();
		vi.mocked(buildNearbyDepartures).mockResolvedValue({
			departures: [
				{
					stopRef: "ASTUCE:StopPoint:HVR1",
					stopName: "Hôtel de Ville",
					platformName: "A",
					lineId: 10,
					lineNetworkId: 1,
					destination: "Technopôle",
					aimedTime,
					callStatus: "SCHEDULED",
					tracked: true,
					atStop: false,
					journeyId: "ASTUCE::VehicleTracking:42",
					stopAreaRef: "ASTUCE:StopArea:HVR",
					stopAreaName: "Hôtel de Ville",
					distance: 210,
				},
			],
			at: Temporal.Now.instant(),
		});

		const result = await getNearbyDeparturesTool.run({ latitude: 49.4431, longitude: 1.096 });

		expect(buildNearbyDepartures).toHaveBeenCalledWith({ latitude: 49.4431, longitude: 1.096 });
		expect(result).toMatchObject({
			departures: [
				{
					line: "T1",
					network: "Réseau Astuce",
					destination: "Technopôle",
					stop: { stopRef: "ASTUCE:StopArea:HVR", name: "Hôtel de Ville" },
					platform: "A",
					distanceMeters: 210,
					minutesAway: 10,
					realtime: false,
					vehicleTracked: true,
					journeyId: "ASTUCE::VehicleTracking:42",
				},
			],
		});
		expect((result as { departures: { scheduled: string }[] }).departures[0]?.scheduled).toMatch(/\+0[12]:00$/);
	});

	it("rejects coordinates out of range", async () => {
		await expect(getNearbyDeparturesTool.run({ latitude: 120, longitude: 1 })).rejects.toThrow();
	});
});

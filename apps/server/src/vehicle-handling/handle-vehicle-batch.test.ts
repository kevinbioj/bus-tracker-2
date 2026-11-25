import type { VehicleJourney } from "@bus-tracker/contracts";
import { describe, expect, it, vi } from "vitest";

import { keepLatestJourneys } from "./handle-vehicle-batch.js";

vi.mock("./import/import-lines.js", () => ({ importLines: vi.fn() }));
vi.mock("./import/import-network.js", () => ({ importNetwork: vi.fn() }));
vi.mock("./import/import-vehicles.js", () => ({ importVehicles: vi.fn() }));
vi.mock("./register-activities.js", () => ({ registerActivities: vi.fn() }));
vi.mock("./register-destinations.js", () => ({ registerDestinations: vi.fn() }));

const journey = (id: string, updatedAt: string) => ({ id, updatedAt }) as VehicleJourney;

describe("keepLatestJourneys", () => {
	it("ne garde que la dernière publication de chaque course", () => {
		expect(keepLatestJourneys([journey("a", "1"), journey("b", "1"), journey("a", "2")])).toEqual({
			journeys: [journey("b", "1"), journey("a", "2")],
			withdrawnJourneyIds: [],
		});
	});

	it("retire la course publiée avant son retrait, sous son identifiant publié", () => {
		expect(keepLatestJourneys([journey("network/a", "1"), "network/a"])).toEqual({
			journeys: [],
			withdrawnJourneyIds: ["network_a"],
		});
	});

	it("garde la course republiée après son retrait", () => {
		expect(keepLatestJourneys(["a", journey("a", "2")])).toEqual({
			journeys: [journey("a", "2")],
			withdrawnJourneyIds: [],
		});
	});
});

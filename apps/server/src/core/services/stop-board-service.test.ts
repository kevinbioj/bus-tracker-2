import type { StopDeparture } from "@bus-tracker/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DisposeableVehicleJourney } from "../../types/disposeable-vehicle-journey.js";
import type { StopArea } from "./stop-area-service.js";
import { buildStopDepartures, invalidateStopAreaCaches } from "./stop-board-service.js";
import { requestStopDepartures } from "./stop-departures-service.js";

const { journeyStore, stopArea } = vi.hoisted(() => ({
	journeyStore: new Map<string, DisposeableVehicleJourney>(),
	stopArea: {
		ref: "NET:StopArea:S",
		name: "Station",
		latitude: 0,
		longitude: 0,
		networkRef: "NET",
		stopRefs: ["NET:StopPoint:S1"],
		providerId: "provider",
		sourceId: "source",
		lineRefs: ["NET:Line:1"],
		updatedAt: "2026-11-25T09:00:00Z",
		networkId: 1,
		networkIds: [1],
	} satisfies StopArea,
}));

vi.mock("../store/journey-store.js", () => ({ journeyStore }));
vi.mock("./line-ref-service.js", () => ({
	findLinesRefs: vi.fn(),
	resolveLineRefs: vi.fn(async (refs: string[]) => new Map(refs.map((ref) => [ref, { id: 10, networkId: 1 }]))),
}));
vi.mock("./service-alert-service.js", () => ({ findStopAlerts: vi.fn() }));
vi.mock("./stop-area-service.js", () => ({
	findStopArea: vi.fn(async () => stopArea),
	findStopAreaOfStopPoint: vi.fn(),
	findStopAreasWithin: vi.fn(),
	invalidateStopAreaManifests: vi.fn(),
}));
vi.mock("./stop-departures-service.js", () => ({ requestStopDepartures: vi.fn() }));

const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

const providerDeparture = (overrides: Partial<StopDeparture> = {}): StopDeparture => ({
	stopRef: "NET:StopPoint:S1",
	stopName: "S1",
	lineRef: "NET:Line:1",
	aimedTime: inMinutes(5),
	callStatus: "SCHEDULED",
	journeyRef: "NET:ServiceJourney:T1",
	serviceDate: "2026-11-25",
	...overrides,
});

const trackedJourney = (type: "GPS" | "COMPUTED"): DisposeableVehicleJourney => ({
	id: "NET::VehicleTracking:42",
	countryCode: "FR",
	networkId: 1,
	lineId: 10,
	journeyRef: "NET:ServiceJourney:T1",
	serviceDate: "2026-11-25",
	position: { latitude: 0, longitude: 0, atStop: false, type, recordedAt: new Date().toISOString() },
	calls: [
		{
			aimedTime: inMinutes(5),
			expectedTime: inMinutes(6),
			stopRef: "NET:StopPoint:S1",
			stopName: "S1",
			stopOrder: 1,
			callStatus: "SCHEDULED",
		},
		{ aimedTime: inMinutes(15), stopRef: "NET:StopPoint:T", stopName: "T", stopOrder: 2, callStatus: "SCHEDULED" },
	],
	updatedAt: new Date().toISOString(),
});

async function departuresWith(departure: StopDeparture, journey: DisposeableVehicleJourney) {
	journeyStore.set(journey.id, journey);
	vi.mocked(requestStopDepartures).mockResolvedValue({
		departures: [departure],
		excludedJourneys: [],
		passedCallDetection: "VEHICLE",
	});
	const { payload } = await buildStopDepartures(stopArea.ref, "departures");
	if (payload === undefined) throw new Error("No departures payload");
	return payload.departures;
}

describe("buildStopDepartures", () => {
	beforeEach(() => {
		journeyStore.clear();
		invalidateStopAreaCaches();
	});

	it("rattache le passage à la course suivie", async () => {
		const [departure, ...others] = await departuresWith(providerDeparture(), trackedJourney("GPS"));

		expect(others).toEqual([]);
		expect(departure).toMatchObject({
			tracked: true,
			journeyId: "NET::VehicleTracking:42",
			callStatus: "SCHEDULED",
		});
	});

	it.each(["GPS", "COMPUTED"] as const)("annonce supprimée la course que suit encore un véhicule %s", async (type) => {
		const departures = await departuresWith(
			providerDeparture({ callStatus: "SKIPPED", canceled: true }),
			trackedJourney(type),
		);

		expect(departures).toHaveLength(1);
		expect(departures[0]).toMatchObject({ tracked: false, callStatus: "SKIPPED", canceled: true });
		expect(departures[0]?.journeyId).toBeUndefined();
	});
});

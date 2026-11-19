import { describe, expect, it, vi } from "vitest";

import type { DisposeableVehicleJourney } from "../../types/disposeable-vehicle-journey.js";

vi.mock("../database/database.js", () => ({ database: {} }));
vi.mock("../store/journey-store.js", () => ({ journeyStore: new Map() }));
vi.mock("./stop-area-service.js", () => ({ findStopAreaOfStopPoint: vi.fn() }));

const { isNearShowcaseOrigin, pickUpcomingCalls, scoreShowcaseCandidate, scoreShowcaseDetails } = await import(
	"./vehicle-journey-showcase.js"
);

const now = Temporal.Instant.from("2026-11-19T09:00:00Z");

const call = (stopRef: string, expectedTime?: string) => ({
	aimedTime: "2026-11-19T09:05:00Z",
	expectedTime,
	stopRef,
	stopName: stopRef,
	stopOrder: 1,
	callStatus: "SCHEDULED" as const,
});

const journey = (overrides: Partial<DisposeableVehicleJourney> = {}): DisposeableVehicleJourney =>
	({
		id: "ASTUCE:TCAR:1",
		countryCode: "FR",
		networkId: 1,
		lineId: 10,
		vehicle: { id: 100, number: "5201" },
		calls: [call("A"), call("B"), call("C")],
		position: {
			latitude: 49.44,
			longitude: 1.09,
			atStop: false,
			type: "GPS",
			recordedAt: "2026-11-19T08:59:30Z",
		},
		updatedAt: "2026-11-19T08:59:30Z",
		...overrides,
	}) as DisposeableVehicleJourney;

describe("scoreShowcaseCandidate", () => {
	it("rejects journeys whose popup would be incomplete", () => {
		expect(scoreShowcaseCandidate(journey({ lineId: undefined }), now)).toBeUndefined();
		expect(scoreShowcaseCandidate(journey({ calls: [call("A")] }), now)).toBeUndefined();
	});

	it("prefers GPS positions and known vehicles without requiring them", () => {
		const computed = journey();
		computed.position = { ...computed.position, type: "COMPUTED" };
		expect(scoreShowcaseCandidate(computed, now)).toBe(1);
		expect(scoreShowcaseCandidate(journey({ vehicle: undefined }), now)).toBe(4);
		expect(scoreShowcaseCandidate(journey({ vehicle: { number: "5201" } }), now)).toBe(5);
	});

	it("rejects stale positions", () => {
		const stale = journey();
		stale.position = { ...stale.position, recordedAt: "2026-11-19T08:55:00Z" };
		expect(scoreShowcaseCandidate(stale, now)).toBeUndefined();
	});

	it("favours journeys carrying more information", () => {
		const bare = scoreShowcaseCandidate(journey(), now);
		const rich = scoreShowcaseCandidate(
			journey({
				occupancy: "LOW",
				wheelchairAccessible: true,
				bikesAllowed: false,
				calls: [call("A", "2026-11-19T09:06:00Z"), call("B"), call("C")],
			}),
			now,
		);
		expect(bare).toBe(5);
		expect(rich).toBe(11);
	});
});

describe("scoreShowcaseDetails", () => {
	it("counts known air conditioning and network logos", () => {
		expect(scoreShowcaseDetails({ airConditioning: undefined, hasNetworkLogo: false })).toBe(0);
		expect(scoreShowcaseDetails({ airConditioning: "ABSENT", hasNetworkLogo: true })).toBe(2);
		expect(scoreShowcaseDetails({ airConditioning: "PRESENT", hasNetworkLogo: true })).toBe(5);
	});
});

describe("pickUpcomingCalls", () => {
	const timedCall = (stopRef: string, time: string, callStatus: "SCHEDULED" | "SKIPPED" = "SCHEDULED") => ({
		...call(stopRef),
		aimedTime: time,
		callStatus,
	});

	it("keeps the calls the vehicle will reach in more than 90 seconds", () => {
		const calls = pickUpcomingCalls(
			journey({
				calls: [
					timedCall("passed", "2026-11-19T08:58:00Z"),
					timedCall("imminent", "2026-11-19T09:01:00Z"),
					timedCall("skipped", "2026-11-19T09:03:00Z", "SKIPPED"),
					timedCall("next", "2026-11-19T09:04:00Z"),
					timedCall("later", "2026-11-19T09:06:00Z"),
				],
			}),
			now,
		);
		expect(calls.map((call) => call.stopRef)).toEqual(["next", "later"]);
	});

	it("prefers the expected time over the aimed one", () => {
		const late = { ...timedCall("late", "2026-11-19T09:01:00Z"), expectedTime: "2026-11-19T09:05:00Z" };
		expect(pickUpcomingCalls(journey({ calls: [late] }), now).map((call) => call.stopRef)).toEqual(["late"]);
	});
});

describe("isNearShowcaseOrigin", () => {
	const rouen = { latitude: 49.4431, longitude: 1.0993 };

	it("keeps vehicles within 10 km of the user", () => {
		expect(isNearShowcaseOrigin({ latitude: 49.3806, longitude: 1.0237 }, rouen)).toBe(true);
	});

	it("rejects vehicles farther away", () => {
		expect(isNearShowcaseOrigin({ latitude: 49.4944, longitude: 0.1079 }, rouen)).toBe(false);
	});
});

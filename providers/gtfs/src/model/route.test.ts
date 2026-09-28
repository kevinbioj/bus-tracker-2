import { describe, expect, it } from "vitest";

import { parseRouteType } from "./route.js";

describe("parseRouteType", () => {
	it("reads the base GTFS route types", () => {
		expect(parseRouteType("0")).toBe("TRAMWAY");
		expect(parseRouteType("2")).toBe("RAIL");
		expect(parseRouteType("3")).toBe("BUS");
		expect(parseRouteType("11")).toBe("TROLLEY");
	});

	it("reads the extended GTFS route types by family", () => {
		expect(parseRouteType("106")).toBe("RAIL");
		expect(parseRouteType("200")).toBe("COACH");
		expect(parseRouteType("401")).toBe("SUBWAY");
		expect(parseRouteType("704")).toBe("BUS");
		expect(parseRouteType("715")).toBe("BUS");
		expect(parseRouteType("800")).toBe("TROLLEY");
		expect(parseRouteType("900")).toBe("TRAMWAY");
		expect(parseRouteType("1200")).toBe("FERRY");
		expect(parseRouteType("1300")).toBe("GONDOLA");
		expect(parseRouteType("1400")).toBe("FUNICULAR");
	});

	it("keeps 700 as a coach", () => {
		expect(parseRouteType("700")).toBe("COACH");
	});

	it("falls back to unknown", () => {
		expect(parseRouteType("")).toBe("UNKNOWN");
		expect(parseRouteType("8")).toBe("UNKNOWN");
		expect(parseRouteType("1100")).toBe("UNKNOWN");
		expect(parseRouteType("toString")).toBe("UNKNOWN");
	});
});

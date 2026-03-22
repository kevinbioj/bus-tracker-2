import { describe, expect, it } from "vitest";
import { getDistance } from "./get-distance.js";

describe("getDistance", () => {
	it("calculates the distance between two points", () => {
		// Paris to Lyon (~391km)
		const dist = getDistance(48.8566, 2.3522, 45.764, 4.8357);
		expect(Math.round(dist / 1000)).toBe(391);
	});

	it("returns 0 for the same point", () => {
		const dist = getDistance(48.8566, 2.3522, 48.8566, 2.3522);
		expect(dist).toBe(0);
	});
});

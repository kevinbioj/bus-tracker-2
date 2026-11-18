import type { StopAreaManifest } from "@bus-tracker/contracts";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../index.js", () => ({ redis: { isReady: false } }));
vi.mock("./stop-area-service.js", () => ({ resolveNetworkIds: vi.fn() }));

const { buildStopSearchIndex, searchIndexedStopAreas } = await import("./stop-search-service.js");

const manifest = (ref: string, name: string, networkRef: string, lineRefs: string[] = []): StopAreaManifest => ({
	ref,
	name,
	latitude: 49.44,
	longitude: 1.09,
	networkRef,
	stopRefs: [],
	providerId: "rouen",
	sourceId: "tcar",
	lineRefs,
	updatedAt: "2026-11-18T08:00:00Z",
});

const networkIdsByRef = new Map([
	["ASTUCE", 1],
	["TCL", 2],
]);

const index = buildStopSearchIndex(
	[
		manifest("ASTUCE:StopArea:1", "Gare - Rue Verte", "ASTUCE", ["ASTUCE:Line:T1"]),
		manifest("ASTUCE:StopArea:2", "Théâtre des Arts", "ASTUCE", ["ASTUCE:Line:T1", "ASTUCE:Line:F1"]),
		manifest("ASTUCE:StopArea:3", "Gare", "ASTUCE"),
		manifest("TCL:StopArea:1", "Gare Part-Dieu", "TCL"),
		manifest("UNKNOWN:StopArea:1", "Gare fantôme", "UNKNOWN"),
	],
	networkIdsByRef,
);

describe("buildStopSearchIndex", () => {
	it("drops stop areas of unknown networks and indexes them by line", () => {
		expect(index.stopAreas.map((stopArea) => stopArea.ref)).not.toContain("UNKNOWN:StopArea:1");
		expect(index.byLineRef.get("ASTUCE:Line:T1")?.map((stopArea) => stopArea.ref)).toEqual([
			"ASTUCE:StopArea:1",
			"ASTUCE:StopArea:2",
		]);
	});
});

describe("searchIndexedStopAreas", () => {
	const search = (query: string, networkIds?: number[]) =>
		searchIndexedStopAreas(index.stopAreas, { query, networkIds, limit: 10 }).map((stopArea) => stopArea.name);

	it("ranks exact matches, then prefixes (shortest names first), then substrings", () => {
		expect(search("gare")).toEqual(["Gare", "Gare Part-Dieu", "Gare - Rue Verte"]);
		expect(search("arts")).toEqual(["Théâtre des Arts"]);
	});

	it("ignores accents, case and punctuation", () => {
		expect(search("THEATRE des arts")).toEqual(["Théâtre des Arts"]);
		expect(search("gare rue-verte")).toEqual(["Gare - Rue Verte"]);
	});

	it("matches words given in any order by their prefix", () => {
		expect(search("part gare")).toEqual(["Gare Part-Dieu"]);
	});

	it("filters by network", () => {
		expect(search("gare", [2])).toEqual(["Gare Part-Dieu"]);
	});

	it("returns nothing for an empty query", () => {
		expect(search("  -  ")).toEqual([]);
	});
});

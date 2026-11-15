import { afterEach, describe, expect, it, vi } from "vitest";

import { isPysaeStale, isZenbusStale } from "./staleness.mjs";

const resource = (lastModified) => ({ lastModified, etag: null, hash: "", checkedAt: Temporal.Now.instant() });

const pysaeVersions = [
	{ _id: "a", mod_time: "2026-11-12T14:56:23.034000Z", published: 1763002836 },
	{ _id: "b", mod_time: "2026-11-13T16:29:24.943000Z", published: 1763085658 },
	{ _id: "c", mod_time: "2026-11-14T09:00:00.000000Z", published: null },
];

describe("isPysaeStale", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const stubVersions = (versions) => {
		const fetch = vi.fn(async () => new Response(JSON.stringify(versions)));
		vi.stubGlobal("fetch", fetch);
		return fetch;
	};

	it("lists the GTFS of the group on the host of the static resource", async () => {
		const fetch = stubVersions(pysaeVersions);

		await isPysaeStale(resource(null), { href: "https://api.pysae.com/api/v4/groups/agen/gtfs/pub" });
		await isPysaeStale(resource(null), { href: "https://pysae.com/api/v2/groups/airbus-nantes/gtfs/pub" });

		expect(fetch.mock.calls.map(([url]) => url)).toEqual([
			"https://api.pysae.com/api/v4/groups/agen/gtfs",
			"https://pysae.com/api/v4/groups/airbus-nantes/gtfs",
		]);
	});

	it("compares the last published GTFS with the loaded resource", async () => {
		const href = "https://pysae.com/api/v2/groups/agen/gtfs/pub";

		stubVersions(pysaeVersions);
		expect(await isPysaeStale(resource("Fri, 13 Nov 2026 16:29:24 GMT"), { href })).toBe(false);

		stubVersions(pysaeVersions);
		expect(await isPysaeStale(resource("Thu, 12 Nov 2026 14:56:23 GMT"), { href })).toBe(true);
	});

	it("fails when the group has no published GTFS", async () => {
		stubVersions([pysaeVersions[2]]);

		await expect(
			isPysaeStale(resource(null), { href: "https://pysae.com/api/v2/groups/agen/gtfs/pub" }),
		).rejects.toThrow();
	});
});

describe("isZenbusStale", () => {
	it("compares Last-Modified as dates", async () => {
		const fetchFreshness = vi.fn().mockResolvedValue({ lastModified: "Thu, 1 Jan 2026 03:00:00 GMT", etag: null });

		expect(await isZenbusStale(resource("Thu, 01 Jan 2026 03:00:00 GMT"), { fetchFreshness })).toBe(false);
		expect(await isZenbusStale(resource("Wed, 31 Dec 2025 03:00:00 GMT"), { fetchFreshness })).toBe(true);
	});
});

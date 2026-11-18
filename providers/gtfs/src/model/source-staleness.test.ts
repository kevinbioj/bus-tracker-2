import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { downloadGtfsArchive, extractGtfs } from "../download/download-gtfs.js";
import { importGtfs } from "../import/import-gtfs.js";
import { isStaleByFreshness, type LoadedResource, Source, type SourceOptions } from "./source.js";

vi.mock("../download/download-gtfs.js", () => ({
	downloadGtfsArchive: vi.fn(),
	extractGtfs: vi.fn(),
}));

vi.mock("../import/import-gtfs.js", () => ({
	importGtfs: vi.fn(),
}));

const minutesAgo = (minutes: number) => Temporal.Now.instant().subtract({ minutes });

const makeResource = (overrides: Partial<LoadedResource> = {}): LoadedResource => ({
	lastModified: null,
	etag: null,
	hash: "hash-a",
	checkedAt: minutesAgo(0),
	...overrides,
});

describe("isStaleByFreshness", () => {
	const href = "https://example.com/gtfs.zip";

	it("relies on the last check when the loaded resource has no freshness headers", async () => {
		const fetchFreshness = vi.fn();

		expect(await isStaleByFreshness(makeResource({ checkedAt: minutesAgo(30) }), { href, fetchFreshness })).toBe(false);
		expect(await isStaleByFreshness(makeResource({ checkedAt: minutesAgo(61) }), { href, fetchFreshness })).toBe(true);
		expect(fetchFreshness).not.toHaveBeenCalled();
	});

	it("compares the published freshness headers with the loaded ones", async () => {
		const resource = makeResource({ lastModified: "Thu, 01 Jan 2026 03:00:00 GMT", etag: '"a"' });

		const unchanged = vi.fn().mockResolvedValue({ lastModified: resource.lastModified, etag: resource.etag });
		expect(await isStaleByFreshness(resource, { href, fetchFreshness: unchanged })).toBe(false);

		const changed = vi.fn().mockResolvedValue({ lastModified: resource.lastModified, etag: '"b"' });
		expect(await isStaleByFreshness(resource, { href, fetchFreshness: changed })).toBe(true);
	});
});

describe("Source.updateGtfs", () => {
	const archive = (hash: string) => ({ lastModified: null, etag: `"${hash}"`, hash });

	const makeSource = async (isStaticResourceStale?: SourceOptions["isStaticResourceStale"]) => {
		const source = new Source("test", {
			staticResourceHref: "https://example.com/gtfs.zip",
			excludeScheduled: true,
			disableRoutePaths: true,
			getNetworkRef: () => "TEST",
			isStaticResourceStale,
		});
		vi.mocked(downloadGtfsArchive).mockResolvedValueOnce(archive("hash-a"));
		await source.importGtfs();
		return source;
	};

	beforeEach(() => {
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.mocked(importGtfs).mockImplementation(async () => ({ trips: new Map(), journeys: new Map() }) as never);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("keeps the current resource without downloading when the source deems it fresh", async () => {
		const isStaticResourceStale = vi.fn().mockResolvedValue(false);
		const source = await makeSource(isStaticResourceStale);

		expect(await source.updateGtfs()).toBe(false);
		expect(isStaticResourceStale).toHaveBeenCalledWith(
			source.resource,
			expect.objectContaining({ href: "https://example.com/gtfs.zip", fetchFreshness: expect.any(Function) }),
		);
		expect(downloadGtfsArchive).toHaveBeenCalledTimes(1);
	});

	it("relies on the last check when the staleness check fails", async () => {
		const source = await makeSource(vi.fn().mockRejectedValue(new Error("HEAD not allowed")));

		expect(await source.updateGtfs()).toBe(false);
		expect(downloadGtfsArchive).toHaveBeenCalledTimes(1);

		source.resource = { ...source.resource!, checkedAt: minutesAgo(61) };
		vi.mocked(downloadGtfsArchive).mockResolvedValueOnce(archive("hash-b"));
		expect(await source.updateGtfs()).toBe(true);
	});

	it("keeps the loaded resource when the downloaded archive is identical", async () => {
		const source = await makeSource(vi.fn().mockResolvedValue(true));
		const gtfs = source.gtfs;
		source.resource = { ...source.resource!, checkedAt: minutesAgo(61) };

		vi.mocked(downloadGtfsArchive).mockResolvedValueOnce({ ...archive("hash-a"), etag: '"a2"' });
		expect(await source.updateGtfs()).toBe(false);

		expect(source.gtfs).toBe(gtfs);
		expect(extractGtfs).toHaveBeenCalledTimes(1);
		expect(importGtfs).toHaveBeenCalledTimes(1);
		expect(source.resource?.etag).toBe('"a2"');
		expect(Temporal.Now.instant().since(source.resource!.checkedAt).total("minutes")).toBeLessThan(1);
	});

	it("imports the resource when the downloaded archive differs", async () => {
		const source = await makeSource(vi.fn().mockResolvedValue(true));
		const gtfs = source.gtfs;

		vi.mocked(downloadGtfsArchive).mockResolvedValueOnce(archive("hash-b"));
		expect(await source.updateGtfs()).toBe(true);

		expect(source.gtfs).not.toBe(gtfs);
		expect(source.resource?.hash).toBe("hash-b");
		expect(importGtfs).toHaveBeenCalledTimes(2);
	});
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../server.js", () => ({ redactError: (error: unknown) => error }));

const { createSubscriptionRegistry } = await import("./registry.js");
const { createThrottledNotifier } = await import("./throttled-notifier.js");
const { watchByPolling } = await import("./poll-watcher.js");
const { readListenedUris, trackListenStream } = await import("./listen-tracking.js");
const { parseResourceUri, resourceUri } = await import("../resources/uris.js");

describe("resource URIs", () => {
	it("round-trips ids that need encoding", () => {
		const uri = resourceUri("stopDepartures", "SNCF-10:StopArea:StopArea:OCE87411017");
		expect(uri).toBe("bus-tracker://stops/SNCF-10%3AStopArea%3AStopArea%3AOCE87411017/departures");
		expect(parseResourceUri(uri)).toEqual({ kind: "stopDepartures", id: "SNCF-10:StopArea:StopArea:OCE87411017" });
		expect(parseResourceUri("bus-tracker://stops/SNCF-10:StopArea:X/departures")?.id).toBe("SNCF-10:StopArea:X");
	});

	it("tells line status and line alerts apart", () => {
		expect(parseResourceUri("bus-tracker://lines/28")).toEqual({ kind: "line", id: "28" });
		expect(parseResourceUri("bus-tracker://lines/28/alerts")).toEqual({ kind: "lineAlerts", id: "28" });
		expect(parseResourceUri("bus-tracker://lines/abc")).toBeUndefined();
	});
});

describe("subscription registry", () => {
	it("counts references per URI and indexes them by resource", () => {
		const registry = createSubscriptionRegistry();
		const releaseA = registry.track(["bus-tracker://lines/28", "bus-tracker://stops/A%3AB/departures", "nope://x"]);
		const releaseB = registry.track(["bus-tracker://lines/28", "bus-tracker://stops/A:B/departures"]);

		expect(registry.urisOf("line", 28)).toEqual(["bus-tracker://lines/28"]);
		expect(registry.urisOf("stopDepartures", "A:B")).toEqual([
			"bus-tracker://stops/A%3AB/departures",
			"bus-tracker://stops/A:B/departures",
		]);
		expect(registry.idsOf("stopDepartures")).toEqual(["A:B"]);

		releaseA();
		releaseA();
		expect(registry.has("bus-tracker://lines/28")).toBe(true);
		expect(registry.urisOf("stopDepartures", "A:B")).toEqual(["bus-tracker://stops/A:B/departures"]);

		releaseB();
		expect(registry.isEmpty).toBe(true);
	});
});

describe("throttled notifier", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("sends at once, then at most once per interval, and drops unsubscribed URIs", () => {
		const published: string[] = [];
		let subscribed = true;
		const notifier = createThrottledNotifier(
			(uri) => published.push(uri),
			() => subscribed,
			30_000,
		);

		notifier.notify("a");
		notifier.notify("a");
		notifier.notify("a");
		expect(published).toEqual(["a"]);

		vi.advanceTimersByTime(30_000);
		expect(published).toEqual(["a", "a"]);

		notifier.notify("a");
		subscribed = false;
		vi.advanceTimersByTime(30_000);
		expect(published).toEqual(["a", "a"]);
	});
});

describe("poll watcher", () => {
	it("notifies only when a subscribed resource's fingerprint changes", async () => {
		const registry = createSubscriptionRegistry();
		const release = registry.track(["bus-tracker://lines/7/alerts"]);
		const notified: string[] = [];
		let fingerprint = "v1";

		const watcher = watchByPolling(
			registry,
			{ notify: (uri) => notified.push(uri), prune: () => {}, dispose: () => {} },
			{
				intervalMs: 60_000,
				concurrency: 2,
				maxResourcesPerKind: 10,
				fingerprinters: { lineAlerts: async () => fingerprint },
			},
		);

		await watcher.tick();
		expect(notified).toEqual([]);
		await watcher.tick();
		expect(notified).toEqual([]);

		fingerprint = "v2";
		await watcher.tick();
		expect(notified).toEqual(["bus-tracker://lines/7/alerts"]);

		release();
		fingerprint = "v3";
		await watcher.tick();
		expect(notified).toHaveLength(1);
		watcher.stop();
	});
});

describe("listen tracking", () => {
	it("reads the resource URIs of subscriptions/listen requests only", () => {
		expect(
			readListenedUris({
				method: "subscriptions/listen",
				params: { notifications: { resourceSubscriptions: ["bus-tracker://lines/1", 42] } },
			}),
		).toEqual(["bus-tracker://lines/1"]);
		expect(readListenedUris({ method: "subscriptions/listen", params: { notifications: {} } })).toEqual([]);
		expect(readListenedUris({ method: "tools/list" })).toBeUndefined();
		expect(readListenedUris([{ method: "subscriptions/listen" }])).toBeUndefined();
	});

	it("releases the subscription when the stream is cancelled", async () => {
		const release = vi.fn();
		const source = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode("event: message\n\n"));
			},
		});
		const response = trackListenStream(
			new Response(source, { headers: { "content-type": "text/event-stream" } }),
			new AbortController().signal,
			() => release,
		);

		const reader = response.body!.getReader();
		await reader.read();
		expect(release).not.toHaveBeenCalled();
		await reader.cancel();
		expect(release).toHaveBeenCalledOnce();
	});

	it("does not track rejected listen requests", () => {
		const track = vi.fn();
		trackListenStream(
			new Response("{}", { status: 400, headers: { "content-type": "application/json" } }),
			new AbortController().signal,
			track,
		);
		expect(track).not.toHaveBeenCalled();
	});
});

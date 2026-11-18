import { setImmediate } from "node:timers/promises";
import type { VehicleJourney } from "@bus-tracker/contracts";
import type { RedisClient } from "@bus-tracker/redis";
import pLimit from "p-limit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Gtfs } from "../model/gtfs.js";
import { Source } from "../model/source.js";
import { DeadlineExceededError } from "../utils/deadline.js";
import { computeVehicleJourneys } from "./compute-current-journeys.js";
import { createJourneyPathPublisher } from "./publish-journey-paths.js";
import { publishStopAreas } from "./publish-stop-areas.js";
import { runSourceLoop, type SourceLoopContext } from "./run-source-loop.js";

vi.mock("@bus-tracker/monitoring", () => ({ captureException: vi.fn() }));
vi.mock("./compute-current-journeys.js", () => ({ computeVehicleJourneys: vi.fn() }));
vi.mock("./publish-data-sources.js", () => ({ publishDataSourceManifests: vi.fn() }));
vi.mock("./publish-service-alerts.js", () => ({ publishServiceAlerts: vi.fn() }));
vi.mock("./publish-stop-areas.js", () => ({
	publishStopAreas: vi.fn(),
	getRealtimeServiceFingerprint: vi.fn(() => ""),
}));

function makeSource(id: string, importGtfs: () => Promise<boolean> = async () => true) {
	const source = new Source(id, {
		staticResourceHref: "https://example.com/gtfs.zip",
		getNetworkRef: () => id.toUpperCase(),
	});
	vi.spyOn(source, "importGtfs").mockImplementation(async () => {
		const imported = await importGtfs();
		if (imported) source.gtfs = {} as Gtfs;
		return imported;
	});
	return source;
}

function journeyOf(source: Source) {
	return { id: source.id, networkRef: source.id.toUpperCase() } as VehicleJourney;
}

let stopped = false;

function makeContext(sources: Source[], overrides: Partial<SourceLoopContext> = {}) {
	const published: string[] = [];
	const redis = {
		isReady: true,
		publish: vi.fn(async (_channel: string, message: string) => {
			for (const { id } of JSON.parse(message) as VehicleJourney[]) published.push(id);
			return 1;
		}),
		set: vi.fn(async () => "OK"),
		expire: vi.fn(async () => 1),
	} as unknown as RedisClient;

	const context: SourceLoopContext = {
		providerId: "test",
		sources,
		redis,
		computeDelayMs: 0,
		sourceBudgetMs: 1_000,
		computeLimit: pLimit(2),
		resourceLimit: pLimit(2),
		updateLimit: pLimit(1),
		journeyPaths: createJourneyPathPublisher(900, 300_000),
		resync: new Set(),
		onStuck: vi.fn(),
		sleep: () => (stopped ? new Promise(() => {}) : setImmediate()),
		...overrides,
	};
	return { context, published };
}

async function waitFor(condition: () => boolean) {
	for (let attempt = 0; attempt < 2_000 && !condition(); attempt += 1) await setImmediate();
	expect(condition()).toBe(true);
}

const countOf = (published: string[], id: string) => published.filter((entry) => entry === id).length;

describe("runSourceLoop", () => {
	beforeEach(() => {
		stopped = false;
		vi.spyOn(console, "error").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
		vi.mocked(computeVehicleJourneys).mockImplementation(async (source) => ({
			journeys: [journeyOf(source)],
			paths: {},
		}));
		vi.mocked(publishStopAreas).mockClear();
	});

	afterEach(() => {
		stopped = true;
		vi.restoreAllMocks();
	});

	it("publie une source sans attendre l'import d'une autre", async () => {
		const slow = makeSource("slow", () => new Promise(() => {}));
		const fast = makeSource("fast");
		const { context, published } = makeContext([slow, fast]);

		void runSourceLoop(slow, context);
		void runSourceLoop(fast, context);

		await waitFor(() => countOf(published, "fast") >= 3);
		expect(countOf(published, "slow")).toBe(0);
	});

	it("poursuit les boucles quand le calcul d'une source échoue ou dépasse son budget", async () => {
		const failing = makeSource("failing");
		const healthy = makeSource("healthy");
		let failingCalls = 0;
		vi.mocked(computeVehicleJourneys).mockImplementation(async (source) => {
			if (source === failing) {
				failingCalls += 1;
				throw failingCalls % 2 === 0 ? new DeadlineExceededError() : new Error("broken feed");
			}
			return { journeys: [journeyOf(source)], paths: {} };
		});
		const { context, published } = makeContext([failing, healthy]);

		void runSourceLoop(failing, context);
		void runSourceLoop(healthy, context);

		await waitFor(() => failingCalls >= 4 && countOf(published, "healthy") >= 4);
		expect(countOf(published, "failing")).toBe(0);
	});

	it("signale une itération bloquée sans arrêter les autres sources", async () => {
		const stuck = makeSource("stuck");
		const healthy = makeSource("healthy");
		vi.mocked(computeVehicleJourneys).mockImplementation(async (source) =>
			source === stuck ? new Promise(() => {}) : { journeys: [journeyOf(source)], paths: {} },
		);
		const onStuck = vi.fn();
		const { context, published } = makeContext([stuck, healthy], { onStuck, stuckAfterMs: 20 });

		void runSourceLoop(stuck, context);
		void runSourceLoop(healthy, context);

		await waitFor(() => countOf(published, "healthy") >= 3);
		await vi.waitFor(() => expect(onStuck).toHaveBeenCalledWith(stuck));
	});

	it("ne republie l'inventaire que de la source à resynchroniser", async () => {
		const first = makeSource("first");
		const second = makeSource("second");
		const { context, published } = makeContext([first, second]);

		void runSourceLoop(first, context);
		void runSourceLoop(second, context);
		await waitFor(() => countOf(published, "first") >= 1 && countOf(published, "second") >= 1);

		vi.mocked(publishStopAreas).mockClear();
		context.resync.add("first");
		await waitFor(() => !context.resync.has("first"));

		const republished = vi.mocked(publishStopAreas).mock.calls.map(([, , sources]) => sources.map(({ id }) => id));
		expect(republished).toEqual([["first"]]);
	});
});
